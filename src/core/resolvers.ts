import { homedir } from "node:os"
import * as path from "node:path"

export let createPathResolver =
	(parentDir: string) =>
	(...parts: string[]) => {
		return path.resolve(parentDir, ...parts)
	}

export let home = (...pathParts: string[]) => {
	return createPathResolver(homedir())(...pathParts)
}

const getEnvOrDefault = (
	envVar: string | undefined,
	defaultValue: string
): string => {
	return envVar && envVar !== "undefined" ? envVar : defaultValue
}

export let kitPath = (...parts: string[]) =>
	createPathResolver(getEnvOrDefault(process.env.KIT, home(".kit")))(
		...parts.filter(Boolean)
	)

export let kenvPath = (...parts: string[]) => {
	return createPathResolver(getEnvOrDefault(process.env.KENV, home(".kenv")))(
		...parts.filter(Boolean)
	)
}

export let kitDotEnvPath = () => {
	return createPathResolver(
		getEnvOrDefault(process.env.KIT_DOTENV_PATH, kenvPath(".env"))
	)()
}

export let knodePath = (...parts: string[]) => {
	const knodeDir = getEnvOrDefault(process.env.KNODE, home(".knode"))
	return createPathResolver(knodeDir)(...parts.filter(Boolean))
}
