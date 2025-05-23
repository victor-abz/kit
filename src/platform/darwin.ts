import {
	KIT_FIRST_PATH,
	KIT_DEFAULT_PATH,
	getMainScriptPath,
	isInDir,
	cmd,
	escapeShortcut
} from "../core/utils.js"

import { refreshScripts } from "../core/db.js"
import { existsSync } from "fs"

global.applescript = async (script, options = { silent: true }) => {
	let applescriptPath = kenvTmpPath("latest.scpt")
	await writeFile(applescriptPath, script)

	let p = new Promise<string>((res, rej) => {
		let stdout = ``
		let stderr = ``
		let child = spawn(`/usr/bin/osascript`, [applescriptPath], options)

		child.stdout.on("data", (data) => {
			stdout += data.toString().trim()
		})
		child.stderr.on("data", (data) => {
			stderr += data.toString().trim()
		})

		child.on("exit", () => {
			res(stdout)
		})

		child.on("error", () => {
			rej(stderr)
		})
	})

	return p
}

global.terminal = async (script) => {
	let formattedScript = script.replace(/'|"/g, '\\"')

	let command = `tell application "Terminal"
  if not application "Terminal" is running then launch
  activate
  do script "${formattedScript}"
  end tell
  `

	return await global.applescript(command)
}

global.iterm = async (command) => {
	command = `"${command.replace(/"/g, '\\"')}"`
	let script = `
    tell application "iTerm"
        activate
        if application "iTerm" is running then
            try
                tell the first window to create tab with default profile
            on error
                create window with default profile
            end try
        end if

        delay 0.1

        tell the first window to tell current session to write text ${command}

    end tell
    `.trim()
	return await global.applescript(script)
}

//TODO: refactor this work around if electron ever gets native osascript support
// https://github.com/vercel/hyper/issues/3410
// https://github.com/electron/electron/issues/4418
global.hyper = async (command) => {
	command = `"${command.replace(/"/g, '\\"')}"`
	let script = `
    tell application "Hyper"
      activate
      if application "Hyper" is running then
          tell application "System Events" to keystroke "n" using command down
      end if

      delay 0.5

      tell application "System Events"
        if exists (window 1 of process "Hyper") then
          keystroke ${command}
          key code 36
        end if
      end tell
    end tell
    `.trim()
	return await global.applescript(script)
}

let terminalEditor = (editor) => async (file) => {
	//TODO: Other terminals?
	let supportedTerminalMap = {
		terminal: global.terminal,
		iterm: global.iterm,
		hyper: global.hyper
	}

	let possibleTerminals = () =>
		Object.entries(supportedTerminalMap)
			.filter(async ([name, value]) => {
				return fileSearch(name, {
					onlyin: "/",
					kind: "application"
				})
			})
			.map(([name, value]) => ({ name, value: name }))

	let KIT_TERMINAL = await global.env("KIT_TERMINAL", {
		placeholder: `Which Terminal do you use with ${editor}?`,
		choices: possibleTerminals()
	})

	return supportedTerminalMap[KIT_TERMINAL](`${editor} ${file}`)
}

let execConfig = () => {
	return {
		shell: true,
		env: {
			HOME: home(),
			PATH: KIT_FIRST_PATH
		}
	}
}

let macEditors = [
	"atom",
	"code",
	"cursor",
	"cursor-nightly",
	"windsurf",
	"emacs",
	"nano",
	"ne",
	"nvim",
	"sublime",
	"webstorm",
	"vim",
	"zed"
]

let safeReaddir = async (path: string) => {
	try {
		return await readdir(path)
	} catch (e) {
		return []
	}
}

global.selectKitEditor = async (reset = false) => {
	let globalBins = []
	let binPaths = KIT_DEFAULT_PATH.split(":")
	for await (let binPath of binPaths) {
		let bins = await safeReaddir(binPath)
		for (let bin of bins) {
			let value = path.resolve(binPath, bin)
			globalBins.push({
				name: bin,
				description: value,
				value
			})
		}
	}

	let possibleEditors = () => {
		let filteredMacEditors = macEditors
			.map((editor) => {
				if (editor === "windsurf") {
					const windsurfPath = "/Users/johnlindquist/.codeium/windsurf/bin/windsurf"
					try {
						if (existsSync(windsurfPath)) {
							return {
								name: "windsurf",
								description: windsurfPath,
								value: windsurfPath
							}
						}
					} catch (error) {
						// Ignore error if path doesn't exist
					}
				}
				return globalBins.find(({ name }) => name === editor)
			})
			.filter(Boolean)

		filteredMacEditors.push({
			name: "kit",
			description: "built-in Script Kit editor",
			value: "kit"
		})

		return filteredMacEditors
	}
	return await global.env("KIT_EDITOR", {
		description: `Select a code editor for Script Kit`,
		name: " ",
		reset,
		resize: false,
		height: PROMPT.HEIGHT.XL,
		placeholder: "Which code editor do you use?",
		preview: md(`
> You can change your editor later in .env

## Don't see your editor?

Set up your editor's command-line tools:

- [Visual Studio Code](https://code.visualstudio.com/docs/setup/mac#_launching-from-the-command-line)
- [WebStorm](https://www.jetbrains.com/help/webstorm/working-with-the-ide-features-from-command-line.html)
- [Sublime](https://www.sublimetext.com/docs/command_line.html)
- [Atom](https://flight-manual.atom.io/getting-started/sections/installing-atom/#installing-atom-on-mac)

## Customized your editor command?

If you edited your ~/.zshrc (or similar) for a custom command then sync your PATH to Script Kit's .env:

Run the following in your terminal:
~~~bash
pnpm node ~/.kit/cli/sync-path.js ~/.kenv/.env
~~~

## Still not working?

Kit.app reads the \`KIT_EDITOR\` value from your \`~/.kenv/.env\`. It can either be a command on the PATH
or an absolute path to your editor. This prompt is attempting to set that value for you, but you can also do it manually.

If you need additional help, we're happy to answer questions:

- [GitHub Discussions](https://github.com/johnlindquist/kit/discussions/categories/q-a)
    `),
		choices: [
			...possibleEditors(),
			{
				name: "None. Always copy path to clipboard",
				value: "copy"
			}
		]
	})
}

let execAndLogCommand = async (
	command: string,
	config: Parameters<typeof exec>[1]
) => {
	global.log(`${process.pid}: > ${command}`)
	return exec(command, config)
}
let atom = async (file: string, dir: string) => {
	let command = `${global.env.KIT_EDITOR} '${file}' ${dir ? ` '${dir}'` : ``}`
	await execAndLogCommand(command, execConfig())
}

let code = async (file, dir, line = 0, col = 0) => {
	let codeArgs = ["--goto", `'${file}:${line}:${col}'`]
	if (dir) codeArgs = [...codeArgs, "--folder-uri", `'${dir}'`]
	let command = `${global.env.KIT_EDITOR} ${codeArgs.join(" ")}`

	let config = execConfig()

	await execAndLogCommand(command, config)
}

let webstorm = async (file, dir, line = 0) => {
	let command = `open -na "WebStorm.app" --args --line ${line} ${file}`

	let config = execConfig()

	await execAndLogCommand(command, config)
}

let vim = terminalEditor("vim")
let nvim = terminalEditor("nvim")
let nano = terminalEditor("nano")
let fullySupportedEditors = {
	code,
	cursor: code,
	["cursor-nightly"]: code,
	windsurf: code,
	zed: atom,
	vim,
	nvim,
	nano,
	atom,
	webstorm
}

global.edit = async (f, dir, line = 0, col = 0) => {
	// console.log(`📝 Edit ${f}`)
	let file = path.resolve(f?.startsWith("~") ? f.replace(/^~/, home()) : f)
	if (global.flag?.edit === false) return

	let KIT_EDITOR = await global.selectKitEditor(false)

	if (KIT_EDITOR === "kit") {
		let language = global.extname(file).replace(/^\./, "")
		let contents = (await readFile(file, "utf8")) || ""
		let extraLibs = await global.getExtraLibs()

		let openMain = false
		let onEscape = async (input, state) => {
			openMain = state?.history[0]?.filePath === getMainScriptPath()
			if (input) submit(input)
		}
		let onAbandon = async (input, state) => {
			if (input) submit(input)
		}

		contents = await editor({
			value: contents,
			description: file,
			language,
			extraLibs,
			onAbandon,
			shortcuts: [
				{
					name: "Close",
					key: `${cmd}+w`,
					onPress: async (input, state) => {
						exit()
					},
					bar: "right"
				},
				{
					name: "Save and Close",
					key: "escape",
					onPress: onEscape,
					bar: "right"
				}
			]
		})

		await writeFile(file, contents)
		if (openMain) {
			await refreshScripts()

			await mainScript()
		}
	} else {
		await hide()

		let execEditor = async (file: string) => {
			let editCommand = `"${KIT_EDITOR}" "${file}"`
			let config = execConfig()
			let { exitCode, stdout, stderr } = await execAndLogCommand(
				editCommand,
				config
			)

			global.log(
				`${process.pid}: Edit command exited with ${exitCode}. ${
					exitCode === 0 ? "✅" : "❌"
				}`
			)

			if (exitCode !== 0) {
				global.log(`Stdout: ${stdout}`)
				global.log(`Stderr: ${stderr}`)
			}
		}
		let editorFn =
			fullySupportedEditors[path.basename(KIT_EDITOR)] || execEditor

		try {
			await editorFn(file, dir, line, col)
		} catch {}
	}
}

global.openLog = () => {
	let logPath = global.kitScript
		.replace("scripts", "logs")
		.replace(new RegExp(`\${kitMode()}$`), "log")

	console.log(`📂 Open log ${logPath}`)

	global.edit(logPath)
}
