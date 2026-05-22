const output = document.querySelector("#terminal-output");
const form = document.querySelector("#terminal-form");
const input = document.querySelector("#terminal-input");
const promptLabel = document.querySelector("#prompt-label");
const terminalTitle = document.querySelector("#terminal-title");

const state = {
  cwd: "/home",
  history: [],
  historyIndex: 0,
  booted: false,
};

const fileTree = {
  "/home": {
    type: "dir",
    children: ["about", "now.txt", "contact.txt"],
  },
  "/home/about": {
    type: "dir",
    children: ["bio.txt", "stack.txt", "interests.txt"],
  },
  "/home/now.txt": {
    type: "file",
    content: [
      ["accent", "Current focus"],
      "Building useful software, polishing a personal site, and collecting work that deserves a permanent home.",
    ],
  },
  "/home/contact.txt": {
    type: "file",
    content: [
      "email: jinli@college.harvard.edu",
    ],
  },
  "/home/about/bio.txt": {
    type: "file",
    content: [
      ["accent", "Jinyang Li"],
      "Hey, I am Jinyang. I am a statistics and quantitative researcher.",
    ],
  },
  "/home/about/stack.txt": {
    type: "file",
    content: [
      ["table", [
        ["Languages", "JavaScript, Python, TypeScript, SQL"],
        ["Tools", "Git, Figma, Node, cloud platforms"],
        ["Focus", "Frontend systems, data products, automation"],
      ]],
    ],
  },
  "/home/about/interests.txt": {
    type: "file",
    content: [
      "Interactive interfaces, clean information design, practical tooling, and small details that make software feel quick.",
    ],
  },
};

const commands = {
  please: "show available commands",
  ls: "list directory contents",
  cd: "change directory; for forwards, cd <directory>, for backwards, cd ..",
  cat: "print file contents",
  pwd: "print current directory",
  whoami: "find out...",
};

const asciiLogo = String.raw`
     _  ___  _   _  ___  _   _  ____  _  _
    | ||_ _|| \ | ||_ _|| | | |/ ___|| || |
 _  | | | | |  \| | | | | | | |\___ \| || |
| |_| | | | | |\  | | | | |_| | ___) |_||_|
 \___/ |___||_| \_||___| \___/ |____/(_)(_)
  \\___\\___\\___\\___\\___\\___\\___\\___
   \\___\\___\\___\\___\\___\\___\\___\\__
    \\___\\___\\___\\___\\___\\___\\___\\_
     \\___\\___\\___\\___\\___\\___\\___\\
`;

function sanitize(value) {
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

function appendLine(content = "", className = "terminal-line") {
  const line = document.createElement("p");
  line.className = className;
  line.innerHTML = content;
  output.append(line);
  if (state.booted) output.scrollTop = output.scrollHeight;
}

function appendBlock(content, className = "terminal-line") {
  const block = document.createElement("pre");
  block.className = className;
  block.textContent = content;
  output.append(block);
  if (state.booted) output.scrollTop = output.scrollHeight;
  return block;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function typeBlock(content, className = "terminal-line", speed = 7) {
  const block = appendBlock("", className);

  for (const character of content) {
    block.textContent += character;
    await wait(character === "\n" ? speed * 3 : speed);
  }
}

function appendTable(rows) {
  const table = document.createElement("div");
  table.className = "table terminal-line";

  rows.forEach(([label, value]) => {
    const labelNode = document.createElement("span");
    const valueNode = document.createElement("span");
    labelNode.textContent = label;
    valueNode.textContent = value;
    table.append(labelNode, valueNode);
  });

  output.append(table);
  if (state.booted) output.scrollTop = output.scrollHeight;
}

function updatePrompt() {
  const text = `jinyangli@my-portfolio:~${state.cwd.replace("/home", "") || "/home"}$`;
  promptLabel.textContent = text;
  terminalTitle.textContent = text.replace("$", "");
}

function normalizePath(target = "") {
  if (!target || target === "~") return "/home";

  if (target.startsWith("~/")) {
    return normalizePath(`/home/${target.slice(2)}`);
  }

  const rawPath = target.startsWith("/")
    ? target
    : `${state.cwd}/${target}`;

  const parts = rawPath.split("/").filter(Boolean);
  const resolved = [];

  parts.forEach((part) => {
    if (part === ".") return;
    if (part === "..") {
      resolved.pop();
      return;
    }
    resolved.push(part);
  });

  const finalPath = `/${resolved.join("/")}`.replace(/\/$/, "") || "/";

  if (finalPath === "/" || finalPath === "/home") return "/home";
  if (finalPath.startsWith("/home/")) return finalPath;
  return `/home${finalPath}`;
}

function nodeAt(path) {
  return fileTree[path];
}

function printContent(content) {
  content.forEach((item) => {
    if (Array.isArray(item) && item[0] === "accent") {
      appendLine(`<span class="accent">${sanitize(item[1])}</span>`);
      return;
    }

    if (Array.isArray(item) && item[0] === "table") {
      appendTable(item[1]);
      return;
    }

    appendLine(sanitize(item));
  });
}

function listDirectory(path) {
  const node = nodeAt(path);
  if (!node || node.type !== "dir") {
    appendLine(`<span class="error">${sanitize(path)}: not a directory</span>`);
    return;
  }

  const children = node.children.map((child) => {
    const childPath = `${path}/${child}`.replace("//", "/");
    const childNode = nodeAt(childPath);
    const color = childNode?.type === "dir" ? "cyan" : "yellow";
    const suffix = childNode?.type === "dir" ? "/" : "";
    return `<span class="${color}">${sanitize(child)}${suffix}</span>`;
  });

  appendLine(children.join("   "));
}

function showHelp() {
  appendTable(Object.entries(commands));
}

function runCommand(rawCommand) {
  const command = rawCommand.trim();

  appendLine(
    `<span class="prompt">${sanitize(promptLabel.textContent)}</span> ${sanitize(command)}`,
    "terminal-line command-line"
  );

  if (!command) return;

  state.history.push(command);
  state.historyIndex = state.history.length;

  const [name, ...args] = command.split(/\s+/);

  switch (name.toLowerCase()) {
    case "please":
      showHelp();
      break;

    case "ls":
      listDirectory(normalizePath(args[0] || state.cwd));
      break;

    case "cd": {
      if (!args[0]) {
        appendLine('<span class="warn">cd expects a directory path! </span>');
        break;
      }

      const target = normalizePath(args[0]);
      const node = nodeAt(target);
      if (node?.type === "dir") {
        state.cwd = target;
        updatePrompt();
      } else {
        appendLine(`<span class="error">${sanitize(args[0] || "")}: not a directory</span>`);
      }
      break;
    }

    case "cat": {
      if (!args[0]) {
        appendLine('<span class="warn">cat expects a file path</span>');
        break; 
      }

      const target = normalizePath(args[0]);
      const node = nodeAt(target);
      if (node?.type === "file") {
        printContent(node.content);
      } else {
        appendLine(`<span class="error">${sanitize(args[0])}: not a file</span>`);
      }
      break;
    }

    case "pwd":
      appendLine(state.cwd);
      break;

    case "whoami":
      appendLine('<span class="accent">Jinyang Li, your favorite Supercell gamer; contact me to schedule a Colt 1v1! </span>');
      break;

    default:
      appendLine(`<span class="error">${sanitize(name)}: command not found ;D RIP you </span>`);
  }
}

async function boot() {
  input.disabled = true;
  updatePrompt();
  await typeBlock("session initializing...", "terminal-line muted", 18);
  await wait(180);
  await typeBlock(asciiLogo, "ascii", 2);
  appendLine('type <span class="yellow">please</span> to see a list of commands');
  input.disabled = false;
  input.focus();
  state.booted = true;
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

document.querySelector(".terminal-shell").addEventListener("click", () => {
  input.focus();
});

boot();
