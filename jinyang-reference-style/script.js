const consoleNode = document.querySelector("#console");
const form = document.querySelector("#command-form");
const input = document.querySelector("#command-input");
const promptNode = document.querySelector("#prompt");

const state = {
  cwd: "~",
  booted: false,
  history: [],
  historyIndex: 0,
};

const files = {
  "~": {
    type: "dir",
    children: ["about.txt", "projects.txt", "contact.txt", "links.txt"],
  },
  "~/about.txt": { type: "file", content: "" },
  "~/projects.txt": { type: "file", content: "" },
  "~/contact.txt": { type: "file", content: "" },
  "~/links.txt": { type: "file", content: "" },
};

const commands = {
  help: "display available commands",
  ls: "list files",
  cat: "print a file",
  pwd: "show current directory",
  whoami: "print the site owner",
  clear: "clear the console",
};

const nameArt = String.raw`
     _ ___ _   _ __   __ _    _   _  ____
    | |_ _| \ | |\ \ / // \  | \ | |/ ___|
 _  | || ||  \| | \ V // _ \ |  \| | |  _
| |_| || || |\  |  | |/ ___ \| |\  | |_| |
 \___/|___|_| \_|  |_/_/   \_\_| \_|\____|
`;

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}

function appendLine(html = "", className = "line") {
  const line = document.createElement("p");
  line.className = className;
  line.innerHTML = html;
  consoleNode.append(line);
  if (state.booted) consoleNode.scrollTop = consoleNode.scrollHeight;
  return line;
}

function updatePrompt() {
  promptNode.textContent = `guest@jinyang:${state.cwd}$`;
}

function resolvePath(path) {
  if (!path || path === "~") return "~";
  if (path.startsWith("~/")) return path;
  return `${state.cwd}/${path}`.replace("~/./", "~/");
}

function printHelp() {
  Object.entries(commands).forEach(([command, description]) => {
    appendLine(`<span class="yellow">${command}</span> - ${escapeHtml(description)}`);
  });
}

function runCommand(rawValue) {
  const value = rawValue.trim();
  appendLine(`<span class="green">${escapeHtml(promptNode.textContent)}</span> ${escapeHtml(value)}`);

  if (!value) return;

  state.history.push(value);
  state.historyIndex = state.history.length;

  const [command, ...args] = value.split(/\s+/);

  switch (command.toLowerCase()) {
    case "help":
      printHelp();
      break;

    case "ls":
      appendLine(files["~"].children.map((name) => `<span class="blue">${name}</span>`).join("   "));
      break;

    case "cat": {
      const target = resolvePath(args[0]);
      const file = files[target];
      if (!args[0]) {
        appendLine('<span class="red">cat: missing file name</span>');
      } else if (file?.type === "file") {
        appendLine(escapeHtml(file.content));
      } else {
        appendLine(`<span class="red">cat: ${escapeHtml(args[0])}: no such file</span>`);
      }
      break;
    }

    case "pwd":
      appendLine(state.cwd);
      break;

    case "whoami":
      appendLine("Jinyang");
      break;

    case "clear":
      consoleNode.replaceChildren();
      break;

    default:
      appendLine(`<span class="red">${escapeHtml(command)}: command not found</span>`);
  }
}

async function typeIntoLine(line, text, speed = 8) {
  for (const char of text) {
    line.textContent += char;
    await new Promise((resolve) => setTimeout(resolve, speed));
  }
}

async function boot() {
  input.disabled = true;
  updatePrompt();

  await typeIntoLine(appendLine("", "line muted"), "initializing jinyang.dev...");
  await new Promise((resolve) => setTimeout(resolve, 120));
  await typeIntoLine(appendLine("", "line aqua"), nameArt, 1);
  appendLine('Type <span class="yellow">help</span> to see available commands.');

  state.booted = true;
  input.disabled = false;
  input.focus();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.booted) return;

  runCommand(input.value);
  input.value = "";
});

input.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.historyIndex = Math.max(0, state.historyIndex - 1);
    input.value = state.history[state.historyIndex] || "";
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.historyIndex = Math.min(state.history.length, state.historyIndex + 1);
    input.value = state.history[state.historyIndex] || "";
  }
});

document.querySelector(".terminal").addEventListener("click", () => {
  input.focus();
});

boot();
