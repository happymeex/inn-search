import assert from "assert";
import { ExcerptExtractor } from "./ExcerptExtractor";
import { PARAGRAPH_DELIMITER } from "./webScrape";

export type SearchParams = {
    caseSensitive: boolean;
};

/**
 * Scores a chapter of text given an array of search words and computes
 * a list of excerpts containing the search words.
 * Higher score indicates greater precedence in search ranking.
 *
 * @param text chapter text
 * @param searchWords array of search words
 * @param searchParams options
 */
export function scoreText(
    text: string,
    searchWords: string[]
): { score: number; excerpts: string[] } {
    const filteredWords = searchWords
        .filter(
            (word) =>
                searchWords.length < SEARCH_LENGTH_TO_TRIGGER_FILLER ||
                !FILLER.has(word.toLowerCase())
        )
        .filter((word) => word.length > 0);
    const regexes = filteredWords.map((word): [string, RegExp] => [
        word,
        new RegExp(cleanWord(word), `gi`),
    ]);

    let numMatches = 0;
    // maps search words to set of indices
    const indices = new Map<string, number[]>(
        filteredWords.map((word) => [word, []])
    );
    // maps search words to number of matches
    const matchFreqs = new Map<string, number>();
    regexes.forEach(([word, regex]) => {
        const m = [...text.matchAll(regex)];
        if (m.length > 0) numMatches = numMatches + 1;
        const indexList = indices.get(word);
        assert(indexList);
        matchFreqs.set(word, m.length);
        // indices should already be in sorted order
        m.forEach((match) => {
            if (match.index !== undefined) indexList.push(match.index);
        });
    });

    let score = numMatches;
    // frequency scores for individual words
    regexes.forEach(([word, _]) => {
        const freq = matchFreqs.get(word);
        assert(freq !== undefined);
        score *= 1 + freqScore(word.length, text.length, freq);
    });

    // proximity multiplier
    score *= proximityMultiplier([...indices.values()]);

    // gather excerpts

    const allIndices: number[] = [];
    for (const indexArr of indices.values()) allIndices.push(...indexArr);
    const excerpts = new ExcerptExtractor(
        text,
        allIndices,
        EXCERPT_RADIUS,
        PARAGRAPH_DELIMITER
    ).getExcerpts();

    return {
        score,
        excerpts,
    };
}

/**
 * Computes the score of a (word, chapter) pair as a function of word length,
 * chapter length, and number of occurrences of the word in the chapter.
 * Between 0 and 1, tends small; must output 0 if `frequency` is 0.
 *
 * @param length length of word matched
 * @param chaptLength length of chapter word was matched in
 * @param frequency number of matches of word in chapter
 */
function freqScore(
    length: number,
    chaptLength: number,
    frequency: number
): number {
    return Math.sqrt((frequency * length) / chaptLength);
}

/**
 * Computes the proximity multiplier for score, given by the product of
 * 1 + 1/(min diff) over all disjoint pairs of arrays in `indices`
 *
 * @param indices list of arrays, each one sorted in increasing order
 */
function proximityMultiplier(indices: Array<number>[]): number {
    let multiplier = 1;
    for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
            const arr1 = indices[i];
            const arr2 = indices[j];
            assert(arr1 && arr2);
            const diff = minDifference(arr1, arr2);
            if (diff > 0) multiplier *= 1 + 1 / diff;
        }
    }
    return multiplier;
}

/**
 * Computes the minimum absolute value of the difference between any two elements
 * of sorted arrays `arr1` and `arr2`. Returns Infinity if one of them is empty.
 *
 * @param arr1 array sorted in increasing order
 * @param arr2 array sorted in increasing order
 * @returns the minimum nonnegative difference
 */
function minDifference(arr1: number[], arr2: number[]): number {
    let i = 0;
    let j = 0;
    let currMin = Infinity;
    while (i < arr1.length && j < arr2.length) {
        const x1 = arr1[i];
        const x2 = arr2[j];
        assert(x1 !== undefined && x2 !== undefined);
        currMin = Math.min(currMin, Math.abs(x1 - x2));
        if (x1 > x2) {
            j++;
        } else i++;
    }
    return currMin;
}

/**
 * Sanitizes a word so that a RegExp constructed from the result does not throw an error
 *
 * @param word string to clean
 * @returns string with special regex-breaking characters escaped with double backslashes
 */
function cleanWord(word) {
    return word.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
}

const EXCERPT_RADIUS = 200;
const SEARCH_LENGTH_TO_TRIGGER_FILLER = 3;
const FILLER = new Set([
    "a",
    "an",
    "and",
    "at",
    "be",
    "by",
    "did",
    "do",
    "does",
    "for",
    "go",
    "goes",
    "if",
    "in",
    "is",
    "it",
    "the",
    "to",
    "that",
    "was",
    "what",
    "then",
    "than",
    "not",
    "ok",
    "from",
    "isn't",
    "has",
    "have",
    "get",
]);
