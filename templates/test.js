let { default: kill } = await need("tree-kill")

let response = await get(
  `https://api.github.com/repos/johnlindquist/simplescripts`
)
echo(response.data.name + " is working!")

if (response.data.name != "simplescripts") {
  exit()
}
echo(`"new" passed`)

//----------------------

let testingTutorial = "testing-tutorial"
let child = spawnSync(
  `tutorial`,
  [testingTutorial, "--trust", "--no-edit"],
  {
    stdio: "inherit",
  }
)

let testingTutorialFilePath = path.join(
  env.SIMPLE_SRC_PATH,
  testingTutorial + ".js"
)
let tutorialContent = await readFile(
  testingTutorialFilePath,
  "utf8"
)

let tutorialContentBuffer = await readFile(
  testingTutorialFilePath
)
let tutorialTemplateBuffer = await readFile(
  path.join(env.SIMPLE_PATH, "templates", "tutorial.js")
)

if (
  Buffer.compare(
    tutorialContentBuffer,
    tutorialTemplateBuffer
  )
) {
  echo(`successfully used tutorial template`)
} else {
  echo(`tutorial content and template don't match...`)
  echo(tutorialContent)
  echo("-------------------")
  echo(tutorialTemplateContent)
  exit()
}

tutorialContent = tutorialContent.replaceAll("//", "")

await writeFile(testingTutorialFilePath, tutorialContent)
child = spawnSync(
  testingTutorial,
  ["johnlindquist", "--trust", "--no-edit"],
  {
    stdio: "inherit",
    env: {
      TUTORIAL_CONTENT_PATH: ".",
      ...env,
    },
  }
)

echo(`"tutorial" passed`)

//---------------------

let { writeNewEnv } = await import(
  path.join(env.SIMPLE_PATH, "src", "simple", "utils.js")
)
await writeNewEnv(
  "TUTORIAL_CONTENT_PATH",
  "/Users/johnlindquist/projects/blog"
)

let newDefault = "new-default"
child = spawnSync(
  `new`,
  [newDefault, "--trust", "--no-edit"],
  {
    stdio: "inherit",
  }
)

let newDefaultContentPath = path.join(
  env.SIMPLE_SRC_PATH,
  newDefault + ".js"
)
let newDefaultBuffer = await readFile(newDefaultContentPath)

let defaultTemplateBuffer = await readFile(
  path.join(env.SIMPLE_PATH, "templates", "default.js")
)

if (
  Buffer.compare(newDefaultBuffer, defaultTemplateBuffer)
) {
  echo(
    `"new" passed (used default template after tutorial)`
  )
} else {
  echo(newDefaultContent)
  exit()
}

let testFile = "test.txt"
await writeFile(testFile, "testing")

child = spawn(`share-file`, [testFile, "--trust"], {
  stdio: "inherit",
})

await new Promise((res, rej) => {
  setTimeout(res, 2000)
})
rm(testFile)
kill(child.pid)
echo(`"share-file" passed`)

child = spawn(`pad`, [testFile, "--trust", "--no-edit"], {
  stdio: "inherit",
})

kill(child.pid)
echo(`"pad" passed`)