import { StateGraph, MessagesAnnotation, END, START } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { POST_TOOLS } from './tools.js';
import { checkCaption } from '../instagramCaption.js';
import { logger } from '../../logger.js';

/**
 * Post generation as a LangGraph agent.
 *
 * The shape is the standard agent loop — model, then tools, then back to the
 * model until it stops calling tools — followed by a separate node that forces
 * the result into a Post object.
 *
 * Generation and structuring are separate on purpose. Asking one call to both
 * use tools and emit strict JSON tends to produce one at the expense of the
 * other; splitting them means the loop can range freely and the final shape is
 * still guaranteed.
 */

/** The structured output. This is the contract the panel consumes. */
export const PostSchema = z.object({
  caption: z.string().describe('The full caption, including hashtags, ready to publish.'),
  hook: z.string().describe('The first line, which is all most readers see in the feed.'),
  hashtags: z.array(z.string()).describe('Hashtags without the # prefix.'),
  imageUrl: z
    .string()
    .nullable()
    .describe('Public URL of the generated image, or null if none was generated.'),
  imagePrompt: z
    .string()
    .nullable()
    .describe('The prompt the image was generated from, for regeneration.'),
  altText: z.string().describe('Accessible description of the image.'),
  rationale: z.string().describe('Why this post was written the way it was.'),
});

export type Post = z.infer<typeof PostSchema>;

export interface PostGenerationResult {
  post: Post;
  captionCheck: ReturnType<typeof checkCaption>;
  toolsUsed: string[];
}

const SYSTEM_PROMPT = `You write Instagram posts for TAMID Group at NYU, an undergraduate
organisation that develops professional skills through hands-on work with the Israeli economy.

Hard rules, in order of importance:

1. TAMID is APOLITICAL and ARELIGIOUS. Frame everything through business, professional
   development and the Israeli innovation economy. Never frame the chapter politically or
   religiously. This is a national TAMID rule and the fastest way to damage the chapter.
2. Never invent a fact. No made-up dates, returns, placement rates, company names, partner
   firms or member quotes. Use the chapter_facts tool for anything factual.
3. The four programs are Investment Fund, Consulting, Quant, and Israel Fellowship. There is
   no "Education" program.

Voice: professional, ambitious, concrete. "Build long and short theses" beats "learn about
investing". No hype punctuation, no "thrilled to announce", no emoji as decoration.

Approach: look at what has performed before writing. Look up real facts rather than assuming
them. Generate an image unless the request says otherwise. Always run review_caption before
you finish, and fix anything it blocks.`;

/**
 * The model.
 *
 * Grok and DeepSeek both expose OpenAI-compatible APIs, so ChatOpenAI drives
 * either one by base URL. Which is used is deployment configuration, not
 * something this module should care about.
 */
const buildModel = (temperature = 0.7) => {
  const apiKey = process.env.XAI_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('No model credentials configured. Set XAI_API_KEY (Grok) or DEEPSEEK_API_KEY.');
  }

  const usingXai = Boolean(process.env.XAI_API_KEY);
  return new ChatOpenAI({
    apiKey,
    model: usingXai
      ? (process.env.XAI_MODEL ?? 'grok-4.6')
      : (process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-pro'),
    temperature,
    configuration: {
      baseURL: usingXai
        ? (process.env.XAI_API_URL ?? 'https://api.x.ai/v1')
        : (process.env.DEEPSEEK_API_URL ?? 'https://api.deepseek.com/v1'),
    },
  });
};

export const isPostGraphConfigured = (): boolean =>
  Boolean(process.env.XAI_API_KEY ?? process.env.DEEPSEEK_API_KEY);

const buildGraph = () => {
  const model = buildModel().bindTools(POST_TOOLS);
  const toolNode = new ToolNode(POST_TOOLS);

  const callModel = async (state: typeof MessagesAnnotation.State) => {
    const response = await model.invoke([new SystemMessage(SYSTEM_PROMPT), ...state.messages]);
    return { messages: [response] };
  };

  // Continue looping while the model is still calling tools; stop when it
  // answers in prose, which means it considers the post written.
  const shouldContinue = (state: typeof MessagesAnnotation.State) => {
    const last = state.messages.at(-1) as AIMessage | undefined;
    return last?.tool_calls?.length ? 'tools' : END;
  };

  return new StateGraph(MessagesAnnotation)
    .addNode('model', callModel)
    .addNode('tools', toolNode)
    .addEdge(START, 'model')
    .addConditionalEdges('model', shouldContinue, ['tools', END])
    .addEdge('tools', 'model')
    .compile();
};

/**
 * Runs the graph and returns a Post.
 *
 * The caption is re-checked here rather than trusting that the model ran
 * review_caption: the check is what gates publishing, so it has to be applied
 * to the text that actually comes out.
 */
export const generatePost = async (
  brief: string,
  options: { recursionLimit?: number } = {}
): Promise<PostGenerationResult> => {
  const graph = buildGraph();

  const state = await graph.invoke(
    { messages: [new HumanMessage(brief)] },
    { recursionLimit: options.recursionLimit ?? 12 }
  );

  const toolsUsed = state.messages.flatMap((m) => {
    const calls = (m as AIMessage).tool_calls ?? [];
    return calls.map((c) => c.name);
  });

  // A second, tool-free call turns the conversation into the strict shape.
  const structuring = buildModel(0).withStructuredOutput(PostSchema, { name: 'post' });
  const post = await structuring.invoke([
    new SystemMessage(
      'Convert the preceding conversation into the final post object. Use the image URL ' +
        'that generate_image returned, verbatim; if no image was generated, set imageUrl ' +
        'and imagePrompt to null. Do not invent or alter any fact.'
    ),
    ...state.messages,
  ]);

  const captionCheck = checkCaption(post.caption);
  logger.info({
    message: 'Generated Instagram post',
    toolsUsed,
    captionOk: captionCheck.ok,
    hasImage: post.imageUrl !== null,
  });

  return { post, captionCheck, toolsUsed };
};
