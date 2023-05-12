import assert from "assert";
import fs from "fs";

const TABLE_OF_CONTENTS = "https://wanderinginn.com/table-of-contents/";
const URL_BASE = "https://wanderinginn.com";
const ignore = ["/vol-1-archive", "/contacts/"];

/**
 * Writes each chapter to a file data/i.txt
 *
 * @param rateLimit maximum number of chapters to handle at a time
 * @param pauseTime seconds to pause between batches of requests
 */
export async function allText(rateLimit = 10000, pauseTime = 0): Promise<void> {
    const map = await chapterToURL();
    const chapters: string[] = [];
    const promises: Promise<string>[] = [];

    /** can't do this all concurrently; run into 429 too many requests */
    const entries = [...map.entries()];
    for (const [i, [chapter, url]] of entries.entries()) {
        console.log("starting chapter", i);
        chapters.push(chapter);
        promises.push(chapterText(url));
        if ((i + 1) % rateLimit === 0 || i + 1 === entries.length) {
            await writeToFile(rateLimit * Math.floor(i / rateLimit));
            console.log("finished batch, waiting now...");
            await wait(pauseTime * 1000);
            chapters.length = 0;
            promises.length = 0;
        }
    }
    async function writeToFile(alreadyWritten: number) {
        console.log("writing batch to file, already written", alreadyWritten);
        return (
            Promise.all(promises)
                // format chapter text by appending chapter name to the top
                .then((res) => {
                    return res.map((text, i) => {
                        const chapter = chapters[i];
                        assert(chapter);
                        return chapter + "\n" + text;
                    });
                })
                .then((res) =>
                    Promise.all(
                        res.map((chapter, i) =>
                            fs.writeFile(
                                `data/${alreadyWritten + i}.txt`,
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
}

/**
 * @returns a promise to a map from chapter names to relative URLs
 */
async function chapterToURL(): Promise<Map<string, string>> {
    const regex = /<a[\s]+href="(\/[-\w\/]+)">([\w\-\u2013\(\). ]+)<\/a>/g;
    const res = await fetch(TABLE_OF_CONTENTS);
    const rawHTML = await res.text();
    const matches = [...rawHTML.matchAll(regex)];
    const ret = new Map<string, string>();
    matches.forEach((match) => {
        assert(match[1] && match[2]);
        if (ignore.includes(match[1])) return;
        ret.set(match[2], match[1]);
    });
    return ret;
}

/**
 *
 * @param url a relative url to a chapter
 * @returns a promise for the text of the corresponding chapter as a single string,
 *      paragraphs separated by double newlines
 */
async function chapterText(url: string): Promise<string> {
    console.log("looking at url:", url);
    const regex = new RegExp(
        /<div[\s]+class[\s]*=[\s]*"entry-content">(.*?)<\/div>/,
        "s"
    );
    try {
        const res = await fetch(URL_BASE + url);
        const rawHTML = await res.text();
        const match = rawHTML.match(regex);
        if (!match || !match[1]) {
            throw new Error(`error getting content div for chapter ${url}`);
        }
        return extractText(match[1]);
    } catch (err) {
        console.log("errored on:", url, "error was:", err);
        return "";
    }
}

/**
 * @param rawHTML raw HTML between the <div class="entry-content"> of a chapter's source HTML
 * @returns the text of the chapter as a single string with paragraps separated by double newlines
 */
function extractText(rawHTML: string): string {
    const regex = new RegExp(/<p>(.*?)<\/p>/, "sg");
    const m = [...rawHTML.matchAll(regex)];
    return m
        .map((match) => {
            assert(match[1]);
            return match[1];
        })
        .join("\n\n");
}

function wait(msec: number): Promise<void> {
    return new Promise((resolve, _) => setTimeout(resolve, msec));
}
