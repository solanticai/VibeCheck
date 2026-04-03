/** Realistic Claude Code stdin JSON payloads for testing */

export const EDIT_FILE_PAYLOAD = {
  tool_name: 'Edit',
  tool_input: {
    file_path: '/project/src/components/Button.tsx',
    old_string: 'const Button = () => {',
    new_string: 'const Button: React.FC = () => {',
  },
};

export const WRITE_FILE_PAYLOAD = {
  tool_name: 'Write',
  tool_input: {
    file_path: '/project/src/utils/helpers.ts',
    content: 'export const add = (a: number, b: number) => a + b;\n',
  },
};

export const BASH_COMMAND_PAYLOAD = {
  tool_name: 'Bash',
  tool_input: {
    command: 'npm test',
  },
};

export const BASH_DANGEROUS_PAYLOAD = {
  tool_name: 'Bash',
  tool_input: {
    command: 'rm -rf /',
  },
};

export const READ_FILE_PAYLOAD = {
  tool_name: 'Read',
  tool_input: {
    file_path: '/project/src/index.ts',
  },
};

export const WRITE_ENV_PAYLOAD = {
  tool_name: 'Write',
  tool_input: {
    file_path: '/project/.env',
    content: 'API_KEY=sk_live_test123',
  },
};

export const WRITE_MAIN_BRANCH_PAYLOAD = {
  tool_name: 'Write',
  tool_input: {
    file_path: '/project/src/app.ts',
    content: 'console.log("hello");',
  },
};

export const MALFORMED_PAYLOAD = {
  not_a_tool: true,
  random_data: 12345,
};

export const EMPTY_PAYLOAD = {};

export const MISSING_TOOL_INPUT_PAYLOAD = {
  tool_name: 'Edit',
};

export const SHELL_INJECTION_PAYLOAD = {
  tool_name: 'Edit',
  tool_input: {
    file_path: '/project/src/index.ts; rm -rf /',
    old_string: 'foo',
    new_string: 'bar',
  },
};
