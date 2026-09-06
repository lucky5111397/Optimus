const tools = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file in the repository.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path to the file (e.g. 'src/index.js')"
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files in a directory.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path to the directory (e.g. 'src/')"
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description: "Search for a string or regex pattern in the repository.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The string or regex pattern to search for"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "apply_patch",
      description: "Replace a specific exact block of text in a file with new text. The oldText must exactly match the file's current contents including whitespace.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path to the file"
          },
          oldText: {
            type: "string",
            description: "The exact text to replace. Must exactly match the file contents."
          },
          newText: {
            type: "string",
            description: "The new text to insert."
          }
        },
        required: ["path", "oldText", "newText"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_file",
      description: "Create a new file with the specified content. Fails if the file already exists.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path to the new file"
          },
          content: {
            type: "string",
            description: "The initial content of the new file"
          }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_validation",
      description: "Run an allowed command like 'npm test', 'npm run build', or 'npm run lint'.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The command to run (e.g., 'npm test')"
          }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "git_diff",
      description: "View the current git diff of changes made so far.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "complete_step",
      description: "Mark the current step as complete and move to the next one.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "A summary of what was accomplished in this step."
          }
        },
        required: ["summary"]
      }
    }
  }
];

module.exports = {
  tools
};

