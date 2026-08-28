import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from '../../logger.js';

/**
 * The TAMID marketing gateway, exposed as LangChain tools.
 *
 * The gateway is an MCP server fronting the site database, GA4 reporting, GA4
 * configuration and Instagram — 70-odd tools behind one endpoint. Rather than
 * duplicating any of that here, this discovers what the gateway offers at
 * runtime and wraps each one, so a tool added to any upstream server becomes
 * available to the assistant without a change on this side.
 *
 * Speaking MCP over plain HTTP rather than pulling in an MCP client library:
 * the stateless transport is two JSON-RPC posts, and the dependency would earn
 * nothing.
 */

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: { type?: string; properties?: Record<string, unknown>; required?: string[] };
}

interface JsonRpcResponse<T> {
  result?: T;
  error?: { message?: string };
}

const gatewayUrl = (): string | undefined => process.env.TAMID_GATEWAY_URL;

export const isGatewayConfigured = (): boolean => Boolean(gatewayUrl());

const rpc = async <T>(method: string, params?: unknown): Promise<T> => {
  const url = gatewayUrl();
  if (!url) throw new Error('TAMID_GATEWAY_URL is not configured.');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // The gateway is stateless, so it answers with JSON rather than a stream,
      // but it still requires the SSE accept type per the MCP spec.
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });

  const text = await response.text();
  let payload: JsonRpcResponse<T>;
  try {
    payload = JSON.parse(text) as JsonRpcResponse<T>;
  } catch {
    throw new Error(`Gateway returned a non-JSON response (${response.status}).`);
  }

  if (payload.error) throw new Error(payload.error.message ?? 'Gateway error');
  if (!payload.result) throw new Error('Gateway returned no result.');
  return payload.result;
};

/**
 * Converts an MCP JSON Schema into a Zod schema.
 *
 * Deliberately shallow: only the field types the gateway actually uses are
 * mapped, and anything unrecognised becomes a permissive value rather than
 * failing. A tool with an unusual schema should still be callable — the server
 * validates properly on its own side regardless.
 */
const toZod = (schema: McpTool['inputSchema']) => {
  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(schema?.required ?? []);

  for (const [key, raw] of Object.entries(schema?.properties ?? {})) {
    const prop = raw as { type?: string; description?: string; enum?: string[] };
    let field: z.ZodTypeAny;

    if (Array.isArray(prop.enum) && prop.enum.length > 0) {
      field = z.enum(prop.enum as [string, ...string[]]);
    } else {
      switch (prop.type) {
        case 'number':
        case 'integer':
          field = z.number();
          break;
        case 'boolean':
          field = z.boolean();
          break;
        case 'array':
          field = z.array(z.unknown());
          break;
        case 'object':
          field = z.record(z.string(), z.unknown());
          break;
        default:
          field = z.string();
      }
    }

    if (prop.description) field = field.describe(prop.description);
    shape[key] = required.has(key) ? field : field.optional();
  }

  return z.object(shape);
};

/**
 * Tools the assistant must never be given.
 *
 * The gateway can delete club records and publish to a public Instagram
 * account. An assistant answering questions in a chat box has no business doing
 * either: a misread question should never be able to remove a board member or
 * post something publicly. Read access is broad; write access is denied.
 */
const DENIED =
  /^(tamid_(create|update|delete|replace)|ga_(create|update|delete|archive|grant|revoke)|ig_(stage|publish))/;

export const loadGatewayTools = async (): Promise<StructuredToolInterface[]> => {
  const listed = await rpc<{ tools?: McpTool[] }>('tools/list');
  const available = listed.tools ?? [];
  const allowed = available.filter((t) => !DENIED.test(t.name));

  logger.info({
    message: 'Loaded gateway tools for the assistant',
    total: available.length,
    allowed: allowed.length,
    withheld: available.length - allowed.length,
  });

  return allowed.map((mcpTool) =>
    tool(
      async (args: Record<string, unknown>) => {
        try {
          const result = await rpc<{ content?: Array<{ text?: string }>; isError?: boolean }>(
            'tools/call',
            { name: mcpTool.name, arguments: args }
          );
          const text = result.content?.map((c) => c.text ?? '').join('\n') ?? '';
          return result.isError ? `Tool reported an error: ${text}` : text;
        } catch (error) {
          // A failing tool should be something the model can reason about and
          // work around, not something that aborts the whole answer.
          return `Could not call ${mcpTool.name}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`;
        }
      },
      {
        name: mcpTool.name,
        description: mcpTool.description ?? mcpTool.name,
        schema: toZod(mcpTool.inputSchema),
      }
    )
  );
};
