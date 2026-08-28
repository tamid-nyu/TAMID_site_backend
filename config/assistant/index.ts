import { StateGraph, MessagesAnnotation, END, START } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, SystemMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { loadGatewayTools, isGatewayConfigured } from './gatewayTools.js';
import { logger } from '../../logger.js';

/**
 * TAssistant — a question-answering agent over the TAMID marketing gateway.
 *
 * A standard agent loop whose tools are discovered from the gateway at runtime,
 * so it can reach the site database, GA4 analytics and Instagram data without
 * any of that being reimplemented here.
 *
 * It is deliberately read-only. gatewayTools withholds every writing tool, so
 * the worst a misunderstood question can do is return the wrong answer.
 */

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantResult {
  answer: string;
  toolsUsed: string[];
}

const SYSTEM_PROMPT = `You are TAssistant, the internal assistant for TAMID Group at NYU.
You answer questions from the chapter's board using live data.

You have tools covering the website database (events, board members, club members, semesters,
contact requests, newsletter signups), Google Analytics for nyutamid.org, and the chapter's
Instagram account and its analytics.

How to work:
- Look things up. Never answer a factual question from memory or assumption — if a tool can
  tell you, call it.
- If a tool fails, say what you could not check rather than guessing around it.
- Answer in plain prose. Give the number and what it means, not a data dump.
- Say plainly when the data does not support a conclusion. "Engagement is down" needs numbers
  behind it.

You are read-only by design: you cannot create, edit or delete records, and you cannot post to
Instagram. If asked to do any of those, say so and describe where in the admin console the
person can do it themselves.

TAMID is apolitical and areligious. Discuss its work through business and professional
development only.`;

const buildModel = () => {
  // DeepSeek is preferred here: this is a high-volume, read-only Q&A surface
  // where cost matters more than the extra capability.
  const deepseek = process.env.DEEPSEEK_API_KEY;
  const xai = process.env.XAI_API_KEY;
  if (!deepseek && !xai) {
    throw new Error('No model credentials configured. Set DEEPSEEK_API_KEY or XAI_API_KEY.');
  }

  return new ChatOpenAI({
    apiKey: deepseek ?? xai,
    model: deepseek
      ? (process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash')
      : (process.env.XAI_MODEL ?? 'grok-4.6'),
    temperature: 0.2,
    configuration: {
      baseURL: deepseek
        ? (process.env.DEEPSEEK_API_URL ?? 'https://api.deepseek.com/v1')
        : (process.env.XAI_API_URL ?? 'https://api.x.ai/v1'),
    },
  });
};

export const isAssistantConfigured = (): boolean =>
  isGatewayConfigured() && Boolean(process.env.DEEPSEEK_API_KEY ?? process.env.XAI_API_KEY);

export const ask = async (
  question: string,
  history: AssistantTurn[] = []
): Promise<AssistantResult> => {
  const tools = await loadGatewayTools();
  const model = buildModel().bindTools(tools);
  const toolNode = new ToolNode(tools);

  const callModel = async (state: typeof MessagesAnnotation.State) => ({
    messages: [await model.invoke([new SystemMessage(SYSTEM_PROMPT), ...state.messages])],
  });

  const shouldContinue = (state: typeof MessagesAnnotation.State) => {
    const last = state.messages.at(-1) as AIMessage | undefined;
    return last?.tool_calls?.length ? 'tools' : END;
  };

  const graph = new StateGraph(MessagesAnnotation)
    .addNode('model', callModel)
    .addNode('tools', toolNode)
    .addEdge(START, 'model')
    .addConditionalEdges('model', shouldContinue, ['tools', END])
    .addEdge('tools', 'model')
    .compile();

  const priorTurns: BaseMessage[] = history.map((turn) =>
    turn.role === 'user' ? new HumanMessage(turn.content) : new AIMessage(turn.content)
  );

  const state = await graph.invoke(
    { messages: [...priorTurns, new HumanMessage(question)] },
    // A generous ceiling: answering "how did we do last month" legitimately
    // takes several lookups, but this stops a loop running away.
    { recursionLimit: 16 }
  );

  const toolsUsed = state.messages.flatMap((m) =>
    ((m as AIMessage).tool_calls ?? []).map((c) => c.name)
  );

  const last = state.messages.at(-1);
  const answer =
    last && !(last instanceof ToolMessage) && typeof last.content === 'string'
      ? last.content
      : 'I could not produce an answer.';

  logger.info({ message: 'TAssistant answered', toolsUsed });

  return { answer, toolsUsed };
};
