import assert from "assert";

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
    searchWords: string[],
    searchParams: SearchParams
): { score: number; excerpts: string[] } {
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

    // gather exerpts

    /**
     * @param index index of the character
     * @returns object whose `right` field is the first index of the subsequent paragraph
     */
    function getParagraph(index: number): {
        left: number;
        right: number;
        text: string;
    } {
        let leftIndex = index;
        let rightIndex = index;
        while (
            leftIndex > 0 &&
            !(text[leftIndex - 1] === "\n" && text[leftIndex - 2] === "\n")
        ) {
            leftIndex--;
        }
        while (
            rightIndex < text.length - 1 &&
            !(text[rightIndex] === "\n" && text[rightIndex + 1] === "\n")
        ) {
            rightIndex++;
        }
        return {
            left: leftIndex,
            right: Math.min(rightIndex + 2, text.length),
            text: text.slice(leftIndex, rightIndex),
        };
    }

    const allIndices: number[] = [];
    for (const indexArr of indices.values()) allIndices.push(...indexArr);
    const excerptIndices = getExcerpts(allIndices, EXCERPT_RADIUS);
    const excerpts: Array<[string, number]> = [];
    for (const cluster of excerptIndices) {
        let clusterText = "";
        let rightMost = 0; // tracks the first index after the most recently added paragraph
        let numHits = 0; // tracks number of indices of the cluster we've seen so far
        for (const index of cluster) {
            if (index >= rightMost) {
                let r = rightMost === 0 ? index : rightMost;
                while (r <= index) {
                    const { left, right, text } = getParagraph(r);
                    clusterText += `<p>${text}</p>`;
                    r = right;
                }
                rightMost = r;
            }
            numHits++;
        }
        if (numHits > 0) {
            excerpts.push([clusterText, numHits]);
        }
    }

    return {
        score,
        excerpts: excerpts.map((item) => item[0]),
    };
}

/**
 * Partitions array into sorted clusters whose consecutive elements
 * differ by at most `distance`
 *
 * @param allIndices array of numbers
 * @returns array of clusters
 */
function getExcerpts(allIndices: number[], distance: number): Array<number[]> {
    const ret: Array<number[]> = [];
    allIndices.sort();
    let firstInCluster = 0;
    for (let i = 0; i < allIndices.length; i++) {
        const curr = allIndices[i];
        const next = allIndices[i + 1];
        if (next !== undefined) {
            assert(curr !== undefined);
            if (next > curr + distance) {
                ret.push(allIndices.slice(firstInCluster, i + 1));
                firstInCluster = i + 1;
            }
        } else {
            // reached the end of the array
            ret.push(allIndices.slice(firstInCluster));
        }
    }
    return ret;
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
