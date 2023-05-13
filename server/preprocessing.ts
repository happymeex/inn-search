import fs from "fs";
import path from "path";

const DATA_PATH = path.resolve(__dirname, "..", "..", "data");
/**
 * Promise to an array whose elements take the form [chapterName, text],
 * in the correct chapter order.
 */
export let ALL_TEXT_PROMISE = loadFiles();

async function loadFiles(): Promise<Array<[string, string]>> {
    console.log("loading files...");
    const promises: Promise<Buffer>[] = [];
    const numChapters = fs.readdirSync(DATA_PATH).length;
    console.log("found", numChapters, "chapters");
    for (let i = 0; i < numChapters; i++) {
        promises.push(
            fs.promises.readFile(path.resolve(DATA_PATH, `${i}.txt`))
        );
    }
    return Promise.all(promises).then((res) =>
        res.map((buffer) => buffer.toString()).map(splitFirstLine)
    );
}

/**
 * Splits a string into two at its first newline character
 *
 * @param str string to split
 */
function splitFirstLine(str: string): [string, string] {
    const index = str.indexOf("\n");
    return [str.slice(0, index), str.slice(index + 1)];
}
/**
 * Rereads the text from files.
 */
export function resetText(): void {
    ALL_TEXT_PROMISE = loadFiles();
}
