import fs from "fs";
import path from "path";
import { writeAll } from "./webScrape";
import { URL, ChapterName, Text } from "./types";

export const DATA_PATH = path.resolve(__dirname, "..", "..", "data");
/**
 * Promise to an array whose elements take the form [chapterName, text],
 * in the correct chapter order.
 */
export let ALL_TEXT_PROMISE: Promise<Array<[ChapterName, URL, Text]>> =
    loadFiles();

async function loadFiles(
    forceReload = false
): Promise<Array<[ChapterName, URL, Text]>> {
    console.log("loading files...");
    const promises: Promise<Buffer>[] = [];
    const numChapters = fs.readdirSync(DATA_PATH).length - 1; // exclude .gitkeep
    console.log("found", numChapters, "chapters");
    if (numChapters === 0 || forceReload) {
        console.log("fetching and writing all chapters to filesys");
        await writeAll(20, 5);
    }
    for (let i = 0; i < numChapters; i++) {
        promises.push(
            fs.promises.readFile(path.resolve(DATA_PATH, `${i}.txt`))
        );
    }
    return Promise.all(promises).then((res) =>
        res.map((buffer) => buffer.toString()).map(splitFirstLines)
    );
}

/**
 * Splits a string into three at its first two newline characters
 *
 * @param str string to split
 */
function splitFirstLines(str: string): [ChapterName, URL, Text] {
    const firstLineBreak = str.indexOf("\n");
    const rest = str.slice(firstLineBreak + 1);
    const secondLineBreak = rest.indexOf("\n");
    return [
        str.slice(0, firstLineBreak),
        rest.slice(0, secondLineBreak),
        rest.slice(secondLineBreak + 1),
    ];
}
/**
 * Rereads the text from files.
 */
export function resetText(forceReload = false): void {
    ALL_TEXT_PROMISE = loadFiles(forceReload);
}
