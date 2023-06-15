import fs from "fs";
import path from "path";
import { URL, ChapterName, Text } from "./types";
import assert from "assert";

const BATCH_SIZE = 8;
const PAUSE_TIME = 2;
const TABLE_OF_CONTENTS = "https://wanderinginn.com/table-of-contents/";
const URL_BASE = "https://wanderinginn.com";
export const PARAGRAPH_DELIMITER = "\n\n";
const IGNORE_URLS = ["/vol-1-archive", "/contacts/", "/2023/03/05/end-vol-1"];
export const DATA_PATH = path.resolve(__dirname, "..", "..", "data");

/**
 * Class to manage fetching, reading, and writing raw chapter data
 */
export class Inventory {
    private nameURL: Promise<Array<[ChapterName, URL]>>;
    private _numChapters = 0;

    public constructor() {
        this._numChapters = fs.readdirSync(DATA_PATH).length - 1; // exclude .gitkeep
        if (this._numChapters === 0) {
            this.reset();
        } else {
            const nameURLPairs: [ChapterName, URL][] = [];
            for (let i = 0; i < this._numChapters; i++) {
                const chapter = fs.readFileSync(
                    path.resolve(DATA_PATH, `${i}.txt`),
                    {
                        encoding: "utf-8",
                    }
                );
                const [name, url, text] = splitFirstLines(chapter);
                nameURLPairs.push([name, url]);
            }
            this.nameURL = (async () => nameURLPairs)();
        }
    }

    public get numChapters() {
        return this._numChapters;
    }

    /**
     * Initiates refetch of table of contents
     */
    private resetChapterList(): void {
        this.nameURL = chapterToURL();
    }

    /**
     * Refetches the table of contents and all chapters and then writes the chapters to the filesystem.
     * The ith chapter is written to `DATA_PATH/i.txt`, and chapters are fetched in batches of
     * `BATCH_SIZE` because fetching all chapters concurrently runs into 429 error.
     * Logs progress to the console.
     *
     * @throws Error if any fetch fails
     */
    public async reset(): Promise<void> {
        this.resetChapterList();
        return this.writeAll(BATCH_SIZE, PAUSE_TIME);
    }

    /**
     * Refetches the table of contents, checks for new chapters, and fetches/writes them to the filesystem.
     *
     * @throws Error if an existing chapter has changed since the last call to reset or update,
     *      or if a chapter fetch fails
     */
    public async update(): Promise<void> {
        const oldNameURL = await this.nameURL;
        this.resetChapterList();
        const nameURL = await this.nameURL;
        for (const [i, [name, url]] of oldNameURL.entries()) {
            const newEntry = nameURL.at(i);
            if (newEntry === undefined) {
                throw new Error(`Chapter ${i} no longer exists`);
            }
            const [newName, newUrl] = newEntry;
            if (newName !== name || newUrl !== url) {
                throw new Error(
                    `Please reset before updating: an existing chapter has changed\n
                    [${name}, ${url}] => [${newName}, ${newUrl}]`
                );
            }
        }
        for (let i = oldNameURL.length; i < nameURL.length; i++) {
            this.writeChapter(i);
        }
    }

    /**
     * Reads a range of chapters from filesystem. For each missing chapter, attempts
     * to fetch and write it to disk before reading again.
     *
     * @param start nonnegative integer chapter number to start loading
     * @param numChapters upper bound on number of chapters to load
     * @returns promise to array of raw chapter data: name, absolute url, and text
     */
    public async loadChapters(
        start: number,
        numChapters: number
    ): Promise<Array<[ChapterName, URL, Text]>> {
        const promises: Promise<string>[] = [];
        const end = Math.min(start + numChapters, this._numChapters);
        for (let i = start; i < end; i++) {
            const chapterPath = path.resolve(DATA_PATH, `${i}.txt`);
            if (!fs.existsSync(chapterPath)) {
                await this.writeChapter(i);
            }
            try {
                promises.push(
                    fs.promises.readFile(chapterPath, { encoding: "utf8" })
                );
            } catch (err) {
                console.log(`Error loading chapter ${i}, ${String(err)}`);
                promises.push((async () => "")());
            }
        }
        return Promise.all(promises).then((res) => res.map(splitFirstLines));
    }

    /**
     * Fetches and writes all chapters to files of the form `DATA_PATH/i.txt`.
     * See the spec for `this.reset`.
     *
     * @param rateLimit maximum number of chapters to handle at a time, default 1000
     * @param pauseTime minutes to pause between batches of requests, default 0
     * @throws Error if a chapter fetch fails
     */
    private async writeAll(
        rateLimit: number,
        pauseTime: number
    ): Promise<void> {
        const nameURL = await this.nameURL;
        const chapterNames: ChapterName[] = [];
        const chapterURLs: URL[] = [];
        const promises: Promise<Text>[] = [];

        for (const [i, [chapterName, url]] of nameURL.entries()) {
            chapterNames.push(chapterName);
            chapterURLs.push(url);
            promises.push(fetchChapter(url));
            if ((i + 1) % rateLimit === 0 || i + 1 === nameURL.length) {
                await writeToFile(
                    rateLimit * Math.floor(i / rateLimit),
                    promises,
                    chapterURLs,
                    chapterNames
                );
                console.log("finished batch, waiting now...");
                this.updateNumChapters();
                await wait(pauseTime * 60 * 1000);
                chapterNames.length = 0;
                chapterURLs.length = 0;
                promises.length = 0;
            }
        }
        console.log("finished fetching and writing all chapters");
    }

    /**
     * Fetches and writes the `i`th chapter of `this.nameURL`.
     *
     * @param i index of chapter to be written
     * @throws Error if `i` is not a valid index in `this.nameURL` or if fetch/write fails
     */
    public async writeChapter(i: number): Promise<void> {
        const nameURL = (await this.nameURL).at(i);
        if (nameURL === undefined)
            throw new Error(`Missing chapter at index ${i}`);
        const [chapterName, url] = nameURL;
        try {
            const text = fetchChapter(url);
            await writeToFile(i, [text], [url], [chapterName]);
            this.updateNumChapters();
        } catch {
            throw new Error(
                `Failed to fetch and write chapter ${i}: ${chapterName} at ${url}`
            );
        }
    }

    /**
     * Update `this._numChapters` to reflect new chapters written to disk, if any
     */
    private updateNumChapters() {
        this._numChapters = Math.max(
            this._numChapters,
            fs.readdirSync(DATA_PATH).length - 1
        );
    }
}

/**
 * Fetches the table of contents and identifies chapter names with their URLs
 *
 * @returns a promise to a list of pairs of the form [chapterName, URL]
 * @throws Error if fetch fails
 */
async function chapterToURL(): Promise<Array<[ChapterName, URL]>> {
    const regex =
        /<a[\s]+href="(https:\/\/wanderinginn.com\/[-\w\/]+)">([\w\-\u2013\(\). ]+)<\/a>/g;
    const res = await fetch(TABLE_OF_CONTENTS);
    const rawHTML = await res.text();
    const pageContent = rawHTML.slice(rawHTML.indexOf(`<div id="content"`));
    const matches = [...pageContent.matchAll(regex)];
    const ret: Array<[string, string]> = [];
    matches.forEach((match) => {
        assert(match[1] && match[2]);
        if (IGNORE_URLS.includes(match[1])) return;
        ret.push([match[2], match[1]]);
    });
    return ret;
}

/**
 * Fetches the text content of the chapter at the given url. If an error occurs,
 * logs the error to console and returns the empty string.
 *
 * @param url an absolute url to a chapter
 * @returns a promise for the text of the corresponding chapter as a single string,
 *      paragraphs separated by double newlines
 */
async function fetchChapter(url: URL): Promise<Text> {
    try {
        const res = await fetch(url);
        const rawHTML = await res.text();
        if (rawHTML.includes("429 Too Many Requests")) {
            throw new Error("429 Too Many Requests");
        }
        const contentDiv = extractContentDiv(rawHTML);
        return extractText(contentDiv);
    } catch (err) {
        console.log("Errored on:", url, String(err));
        return "";
    }
}

/**
 * Given raw HTML text, extracts the contents of the first div matching
 * `<div class="entry-content">`
 *
 * @param rawHTML string representing raw HTML
 * @returns substring of `rawHTML` matching `<div class="entry-content">` up to
 *      but not including the closing div tag of this div, or the rest of `rawHTML`
 *      if the div is not properly closed
 * @throws Error if `rawHTML` does not contain `<div class="entry-content">`
 */
function extractContentDiv(rawHTML: string): string {
    const reg = /<div[\s]+class[\s]*=[\s]*"entry-content">/;
    const m = rawHTML.match(reg);
    if (m === null)
        throw new Error(`Unexpected chapter HTML ${rawHTML.slice(0, 300)}...`);
    const start = m.index;
    assert(start);
    let index = start;
    let numOpenDivs = 1;
    while (numOpenDivs > 0) {
        index++;
        if (index >= rawHTML.length) {
            break;
        }
        if (rawHTML.slice(index, index + 4) === "<div") numOpenDivs++;
        else if (rawHTML.slice(index, index + 5) === "</div") numOpenDivs--;
    }
    return rawHTML.slice(start, index);
}

/**
 * Given a string represeting raw HTML, returns all text content of the HTML occurring between
 * `<p>` tags, joined into a single string by `PARAGRAPH_DELIMITER`
 *
 * @param rawHTML raw HTML
 * @returns the text of the chapter as a single string with paragraphs separated by `PARAGRAPH_DELIMITER`
 */
function extractText(rawHTML: string): Text {
    const regex = new RegExp(/<p>(.*?)<\/p>/, "sg");
    const m = [...rawHTML.matchAll(regex)];
    const rawText = m
        .map((match) => {
            assert(match[1]);
            return match[1];
        })
        .join(PARAGRAPH_DELIMITER);
    return sanitizeText(rawText);
}

/**
 * Writes a batch of chapter texts to files `${startIndex}.txt`, `${startIndex+1}.txt`, ...
 *
 * @param startIndex index of the file to start writing
 * @param chapterTexts array of (promises) to chapter texts to be written in that order
 * @param chapterNames array of chapter names, order aligned with `chapterTexts`
 * @returns
 */
async function writeToFile(
    startIndex: number,
    chapterTexts: Promise<Text>[],
    chapterURLs: URL[],
    chapterNames: ChapterName[]
): Promise<void[]> {
    console.log(
        `Writing ${chapterTexts.length} file(s) starting at chapter ${startIndex}`
    );
    return (
        Promise.all(chapterTexts)
            // format chapter text by appending chapter name to the top
            .then((res) => {
                return res.map((text, i) => {
                    const name = chapterNames[i];
                    const url = chapterURLs[i];
                    assert(name && url);
                    return formatForFile(name, url, text);
                });
            })
            .then((res) =>
                Promise.all(
                    res.map((chapter, i) =>
                        fs.writeFile(
                            path.resolve(DATA_PATH, `${startIndex + i}.txt`),
                            chapter,
                            (err) => {
                                if (err !== null) console.log(err);
                            }
                        )
                    )
                )
            )
    );
}

/**
 * @param chapterName
 * @param url
 * @param text
 * @returns string to be saved into a file
 */
function formatForFile(chapterName: ChapterName, url: URL, text: Text) {
    return chapterName + "\n" + url + "\n" + text;
}

function sanitizeText(text: string): string {
    // match "Previous Chapter" and "Next Chapter" buttons
    const nextPrevButton = /<a href=.*?>.*?Chapter.*?<\/a>/g;
    const images = /<img.*?>|<a href=.*?>.*?<img.*?<\/a>/g;
    const links = /<a href=.*?>(.*?)<\/a>/gs;
    return text
        .replaceAll(nextPrevButton, "")
        .replaceAll(images, "")
        .replaceAll(links, "$1")
        .replaceAll("&nbsp;", " ")
        .replaceAll(`\u2018`, "'")
        .replaceAll(`\u2019`, "'")
        .replaceAll(`\u201c`, `"`)
        .replaceAll(`\u201d`, `"`)
        .replaceAll(`\u2026`, "...");
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

function wait(msec: number): Promise<void> {
    return new Promise((resolve, _) => setTimeout(resolve, msec));
}
