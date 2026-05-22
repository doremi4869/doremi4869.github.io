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
  awaitingPassphrase: false,
  phraseBlock: null,
};

const fileTree = {
  "/home": {
    type: "dir",
    children: ["about", "funstats", "interests"],
  },
  "/home/about": {
    type: "dir",
    children: ["bio.txt", "now.txt", "contact.txt"],
  },
  "/home/interests": {
    type: "dir",
    children: ["math", "physics", "piano", "puzzles", "statistics"],
  },
  "/home/funstats": {
    type: "dir",
    children: ["zetamac.txt"],
  },
  "/home/funstats/zetamac.txt": {
    type: "file",
    content: [
      "highscore: 124",
    ],
  },
  "/home/interests/math": {
    type: "dir",
    children: [],
  },
  "/home/interests/physics": {
    type: "dir",
    children: [],
  },
  "/home/interests/piano": {
    type: "dir",
    children: [],
  },
  "/home/interests/puzzles": {
    type: "dir",
    children: [],
  },
  "/home/interests/statistics": {
    type: "dir",
    children: [],
  },
  "/home/about/now.txt": {
    type: "file",
    content: [
      "I am working at A Priori Investments as a quantitative research intern. In my free time, you may find me studying statistics, physics, or solving puzzles. I may also be practicing piano on my table since I won't have access to one for a while...",
    ],
  },
  "/home/about/contact.txt": {
    type: "file",
    content: [
      "email: jinli@college.harvard.edu",
      "phone: 561-774-1788"
    ],
  },
  "/home/about/bio.txt": {
    type: "file",
    content: [
      "Hey, I am Jinyang, a rising senior at Harvard studying mathematics and statistics. I am passionate about quantitative research in finance, statistics, and science. Currently, I am especially interested in probability theory, market behavior, stochastic processes, and the intersection of statistics and decision-making.",
      "Outside of academics, I love listening and playing classical music, speedcubing, and playing competitive Brawl Stars.",
    ],
  },
};

const commands = {
  help: "show available commands",
  ls: "list directory contents",
  cd: "change directory; for forwards, cd <directory>, for backwards, cd ..",
  cat: "print file contents",
  pwd: "print current directory",
  whoami: "find out...",
};

const introText = "Smiles and laughter are always good, but ";
const passphrase = "never forget your poker face.";
const passphraseWithoutPeriod = "never forget your poker face";
const displayPhraseStart = "never forget your ";
const displayPhraseEmphasis = "Poker Face.";
const displayPhraseEnd = "";

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
    if (state.booted) output.scrollTop = output.scrollHeight;
    await wait(character === "\n" ? speed * 3 : speed);
  }

  return block;
}

async function typeIntoBlock(block, content, speed = 22) {
  const textNode = document.createTextNode("");
  block.append(textNode);

  for (const character of content) {
    textNode.textContent += character;
    if (state.booted) output.scrollTop = output.scrollHeight;
    await wait(speed);
  }
}

async function typeStyledIntoBlock(block, content, className, speed = 22) {
  const span = document.createElement("span");
  span.className = className;
  block.append(span);

  for (const character of content) {
    span.textContent += character;
    if (state.booted) output.scrollTop = output.scrollHeight;
    await wait(speed);
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
  const path = state.cwd.replace("/home", "") || "/home";
  const text = `jinyangli:~${path} %`;
  promptLabel.textContent = text;
  terminalTitle.textContent = text;
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

function setInputValue(value) {
  input.value = value;
  input.setSelectionRange(value.length, value.length);
}

function commonPrefix(values) {
  if (!values.length) return "";

  return values.reduce((prefix, value) => {
    let index = 0;
    while (index < prefix.length && prefix[index] === value[index]) {
      index += 1;
    }
    return prefix.slice(0, index);
  });
}

function pathCompletionParts(partialPath) {
  const slashIndex = partialPath.lastIndexOf("/");

  if (slashIndex === -1) {
    return {
      directory: state.cwd,
      leaf: partialPath,
      visiblePrefix: "",
    };
  }

  const directoryInput = partialPath.slice(0, slashIndex);

  return {
    directory: normalizePath(directoryInput || "/"),
    leaf: partialPath.slice(slashIndex + 1),
    visiblePrefix: partialPath.slice(0, slashIndex + 1),
  };
}

function pathCompletions(partialPath) {
  const { directory, leaf, visiblePrefix } = pathCompletionParts(partialPath);
  const directoryNode = nodeAt(directory);

  if (!directoryNode || directoryNode.type !== "dir") return [];

  return directoryNode.children
    .filter((child) => child.startsWith(leaf))
    .map((child) => {
      const childPath = `${directory}/${child}`.replace("//", "/");
      const childNode = nodeAt(childPath);
      const suffix = childNode?.type === "dir" ? "/" : "";
      return {
        label: `${child}${suffix}`,
        type: childNode?.type || "file",
        value: `${visiblePrefix}${child}${suffix}`,
      };
    });
}

function showCompletionOptions(options) {
  const entries = options.map((option) => {
    const className = option.type === "dir" ? "cyan" : "yellow";
    return `<span class="${className}">${sanitize(option.label)}</span>`;
  });

  appendLine(entries.join("   "));
}

function completeInput() {
  const rawValue = input.value;
  const value = rawValue.trimStart();

  if (!value) return;

  if (!value.includes(" ")) {
    const matches = Object.keys(commands).filter((command) => command.startsWith(value.toLowerCase()));

    if (matches.length === 1) {
      setInputValue(`${matches[0]} `);
      return;
    }

    if (matches.length > 1) {
      showCompletionOptions(matches.map((command) => ({ label: command, type: "file" })));
    }

    return;
  }

  const [rawCommand] = value.split(/\s+/);
  const command = rawCommand.toLowerCase();

  if (!["cat", "cd", "ls"].includes(command)) return;

  const partialPath = value.endsWith(" ")
    ? ""
    : value.slice(rawCommand.length).trimStart();

  if (partialPath.includes(" ")) return;

  const matches = pathCompletions(partialPath);

  if (matches.length === 1) {
    setInputValue(`${command} ${matches[0].value}`);
    return;
  }

  if (matches.length > 1) {
    const sharedPrefix = commonPrefix(matches.map((match) => match.value));
    if (sharedPrefix.length > partialPath.length) {
      setInputValue(`${command} ${sharedPrefix}`);
      return;
    }

    showCompletionOptions(matches);
  }
}

async function printContent(content) {
  for (const item of content) {
    if (Array.isArray(item) && item[0] === "accent") {
      await typeBlock(item[1], "terminal-line accent", 8);
      continue;
    }

    if (Array.isArray(item) && item[0] === "table") {
      appendTable(item[1]);
      continue;
    }

    await typeBlock(item, "terminal-line", 8);
  }
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

async function runCommand(rawCommand) {
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
    case "help":
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
        input.disabled = true;
        try {
          await printContent(node.content);
        } finally {
          input.disabled = false;
          input.focus();
        }
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
      appendLine(`<span class="error">${sanitize(name)}: command not found... use <span class="green">help</span></span>`);
  }
}

async function boot() {
  input.disabled = true;
  promptLabel.textContent = "";
  terminalTitle.textContent = "AUTHORIZATION REQUIRED";
  state.phraseBlock = await typeBlock(introText, "ascii", 24);
  state.awaitingPassphrase = true;
  input.disabled = false;
  input.focus();
}

async function completePassphrase(value) {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue !== passphrase && normalizedValue !== passphraseWithoutPeriod) {
    appendLine('<span class="error">access denied</span>');
    return;
  }

  state.awaitingPassphrase = false;
  input.disabled = true;
  state.phraseBlock.textContent = introText;
  await typeIntoBlock(state.phraseBlock, displayPhraseStart, 22);
  await typeStyledIntoBlock(state.phraseBlock, displayPhraseEmphasis, "blood-red", 22);
  await typeIntoBlock(state.phraseBlock, displayPhraseEnd, 22);
  await wait(140);
  document.body.classList.add("unlocked");
  updatePrompt();
  input.disabled = false;
  input.focus();
  state.booted = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const command = input.value;
  input.value = "";

  if (state.awaitingPassphrase) {
    completePassphrase(command);
    return;
  }

  if (!state.booted) return;

  await runCommand(command);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    if (state.booted && !state.awaitingPassphrase) completeInput();
    return;
  }

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
