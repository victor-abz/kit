let nodeContent = ``

// nodeContent += await readFile(
//   kitPath("node_modules/@types/node/process.d.ts"),
//   "utf8"
// )

// nodeContent += await readFile(
//   kitPath("node_modules/@types/node/child_process.d.ts"),
//   "utf8"
// )

// let nodeTypesDir = path.resolve(
//   "node_modules",
//   "@types",
//   "node"
// )
// let nodeTypeFiles = (await readdir(nodeTypesDir)).filter(
//   f => f.endsWith(".d.ts")
// )

// for (let file of nodeTypeFiles) {
//   nodeContent += await readFile(
//     path.resolve(nodeTypesDir, file),
//     "utf8"
//   )
// }

// nodeContent = nodeContent.replace(
//   /declare module '(\w+)'/g,
//   "declare module $1"
// )

let kitContent = ``

// exclude itself 😇

let defs = (
  await readdir(path.resolve("src", "types"))
).filter(f => !f.includes("kit-editor"))

console.log(defs)

for (let def of defs) {
  kitContent += await readFile(
    path.resolve("src", "types", def),
    "utf8"
  )
}

let globalTypesDir = path.resolve(
  "node_modules",
  "@johnlindquist",
  "globals",
  "types"
)

let globalTypeDirs = (await readdir(globalTypesDir)).filter(
  dir => !dir.endsWith(".ts")
)

console.log(globalTypeDirs)

// GlobalsAPI
kitContent += await readFile(
  path.resolve(globalTypesDir, "index.d.ts"),
  "utf8"
)

//       content = `declare module '@johnlindquist/kit' {

// ${content}

// }`

kitContent = kitContent.replace(
  /import {(.|\n)*?} from ".*?"/gim,
  ""
)

kitContent = kitContent.replace(/export {(.|\n)*?}/gim, "")

await writeFile(
  "./src/types/kit-editor.d.ts",
  nodeContent + kitContent,
  "utf8"
)

export {}