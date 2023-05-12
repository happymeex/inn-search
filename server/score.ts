import assert from "assert";

export type SearchParams = {
    caseSensitive: boolean;
};

/**
 * Scores a chapter of text given an array of search words.
 * Higher score indicates greater precedence in search ranking.
 *
 * @param text chapter text
 * @param searchWords array of search words
 * @param searchParams options
 */
export function scoreText(
    text: string,
    searchWords: string[],
    searchParams: SearchParams
) {
    const filteredWords = searchWords.filter(
        (word) =>
            searchWords.length < SEARCH_LENGTH_TO_TRIGGER_FILLER ||
            !FILLER.has(word.toLowerCase())
    );
    const regexes = filteredWords.map((word): [string, RegExp] => [
        word,
        new RegExp(word, `g${searchParams.caseSensitive ? "" : "i"}`),
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
            if (match.index) indexList.push(match.index);
        });
    });

    let score = numMatches;
    // frequency scores for individual words
    regexes.forEach(([word, _]) => {
        const freq = matchFreqs.get(word);
        assert(freq);
        score *= 1 + freqScore(word.length, text.length, freq);
    });

    // proximity multiplier
    score *= proximityMultiplier([...indices.values()]);

    return score;
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

const SEARCH_LENGTH_TO_TRIGGER_FILLER = 4;
const FILLER = new Set([
    "a",
    "to",
    "the",
    "is",
    "was",
    "it",
    "that",
    "what",
    "then",
    "than",
    "if",
    "not",
    "ok",
    "from",
    "isn't",
    "go",
    "goes",
    "has",
    "have",
    "do",
    "did",
    "does",
    "get",
    "be",
]);
