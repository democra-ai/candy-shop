import Anthropic from '@anthropic-ai/sdk';
import { WebContainer } from '@webcontainer/api';

export type AgentContext = {
  webContainer: WebContainer;
  apiKey: string;
  onLog: (message: string) => void;
}

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'run_command',
    description: 'Run a shell command in the terminal. Use this to execute code, install packages, or run scripts.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command line to execute' }
      },
      required: ['command']
    }
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The path to the file to read' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_to_file',
    description: 'Write content to a file. Overwrites existing files.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The path to the file' },
        content: { type: 'string', description: 'The content to write' }
      },
      required: ['path', 'content']
    }
  },
    {
    name: 'list_dir',
    description: 'List files in a directory.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The directory path (default .)' }
      }
    }
  }
];

export async function runAgentStep(
  messages: Anthropic.MessageParam[],
  context: AgentContext
): Promise<Anthropic.Message> {
    const anthropic = new Anthropic({
        apiKey: context.apiKey,
        dangerouslyAllowBrowser: true 
    });

    const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages,
        tools: TOOLS,
        system: `You are an expert AI Coding Agent running directly in the user's browser via WebContainers.
You have access to a full Node.js environment.
You can run shell commands, read/write files, and install dependencies.
When asked to build something, you should:
1. Plan the structure.
2. Create files using write_to_file.
3. Install dependencies using run_command (npm install ...).
4. Run the code using run_command (node ...).
5. Use list_dir to see what files exist.

Always output the output of your commands to the user using the tool results.
`
    });
    
    return response;
}

export async function executeToolCall(toolCall: Anthropic.ToolUseBlock, context: AgentContext): Promise<Anthropic.ToolResultBlockParam> {
    const { name, input } = toolCall as { name: string, input: any };
    let output = '';
    let isError = false;

    try {
        if (name === 'run_command') {
            const process = await context.webContainer.spawn('sh', ['-c', input.command]);
            let outputBuffer = '';
            process.output.pipeTo(new WritableStream({
                write(data) {
                    outputBuffer += data;
                    context.onLog(data);
                }
            }));
            const exitCode = await process.exit;
            output = outputBuffer + `\nExit code: ${exitCode}`;
            if (exitCode !== 0) isError = true;
        } else if (name === 'read_file') {
            output = await context.webContainer.fs.readFile(input.path, 'utf-8');
        } else if (name === 'write_to_file') {
            // Ensure directory exists (WebContainer doesn't auto-create parent dirs always, but we can try)
            // But for simplicity assume simple paths or robust fs
            // Adding a simplistic recursive mkdir might be needed, but usually writeFile requires dir to exist.
            // We can add logic to mock 'mkdir -p' or use 'mkdir' tool if we added it.
            // For now, let's assume flat or user manages mkdir.
            await context.webContainer.fs.writeFile(input.path, input.content);
            output = `Successfully wrote to ${input.path}`;
        } else if (name === 'list_dir') {
            const files = await context.webContainer.fs.readdir(input.path || '.');
            output = files.join('\n');
        } else {
            output = `Unknown tool: ${name}`;
            isError = true;
        }
    } catch (err: any) {
        output = `Error executing ${name}: ${err.message}`;
        isError = true;
    }

    return {
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: output,
        is_error: isError
    };
}
