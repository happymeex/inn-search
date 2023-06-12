/**
 * Cap the number of occurrences of keywords in the excerpts returned from a single chapter,
 * to avoid memory overflow
 */
const MAX_OCCURRENCES = 250;

/**
 * Utility class for extracting keyword-containing excerpts from a chapter's text given a list of
 * indices corresponding to keyword occurrences.
 */
export class ExcerptExtractor {
    private curr = 0;
    private readonly indices: number[];
    private excerpts: string[] = [];

    /**
     * Creates a new ExcerptExtractor
     *
     * @param text body of text
     * @param indices array of indices, each an integer in the range [0, text.length)
     * @param distance
     * @param delimiter string whose occurence indicates the boundary between two paragraphs
     */
    public constructor(
        private readonly text: string,
        indices: number[],
        private readonly distance: number,
        private readonly delimiter: string
    ) {
        this.indices = [...indices].sort((a, b) => a - b);
    }

    /**
     * @param start integer in the range [0, `this.text.length`)
     * @param end integer in the range [`start`, `this.text.length`)
     * @returns An object with two properties:
     *      `paragraphs`: the smallest possible list of consecutive paragraphs of `this.text` such
     *      that the indices `start` and `end` are each accounted for in some paragraph of the list.
     *      Each paragraph is wrapped with `<p>` HTML tags in the returned array.
     *      `rightMost`: the the largest index of `this.text` accounted for in `paragraphs`
     */
    private getParagraphs(
        start: number,
        end: number
    ): { paragraphs: string[]; rightMost: number } {
        let left = start;
        while (
            left > 0 &&
            this.text.slice(left - this.delimiter.length, left) !==
                this.delimiter
        ) {
            left--;
        }
        let right = end + 1;
        while (
            right < this.text.length &&
            this.text.slice(right, right + this.delimiter.length) !==
                this.delimiter
        ) {
            right++;
        }
        const paragraphs = this.text
            .slice(left, right)
            .split(this.delimiter)
            .map((paragraph) => `<p>${paragraph}</p>`);

        return { paragraphs, rightMost: right - 1 };
    }

    /**
     * Makes an excerpt starting at `this.curr`, pushes it to `this.excerpts`, and
     * mutates `this.curr` to be the smallest index such that `this.indices[this.curr]`
     * has not yet been accounted for.
     */
    private consumeExcerpt(): void {
        if (this.curr >= this.indices.length) return;
        const index = this.indices.at(this.curr)!;
        let progress = this.curr;
        while (true) {
            const nextIndex = this.indices.at(progress + 1);
            if (
                nextIndex === undefined ||
                nextIndex > index + this.distance ||
                progress > MAX_OCCURRENCES
            ) {
                break;
            }
            progress++;
        }
        const rightIndex = this.indices.at(progress)!;
        const { paragraphs, rightMost } = this.getParagraphs(index, rightIndex);
        const excerpt = paragraphs.join("");
        // account for extra occurrences beyond `rightIndex` in the last paragraph
        this.curr = progress + 1;
        let idx = this.indices.at(this.curr);
        while (idx !== undefined && idx <= rightMost) {
            this.curr++;
            idx = this.indices.at(this.curr);
        }
        this.excerpts.push(excerpt);
    }

    /**
     * Computes a list of excerpts, where an excerpt is the concatenation of a number of
     * adjacent formatted paragraphs (a formatted paragraph is a paragraph of the text
     * with HTML tags <p> and </p> appended to the beginning and end). Excerpts are computed
     * greedily by repeating the following procedure: starting at the smallest available index,
     * repeatedly grab the next index within `distance` indices to the right, and then
     * collect the paragraphs spanned by the resulting set of indices.
     */
    public getExcerpts(): string[] {
        if (this.excerpts.length === 0) {
            while (
                this.curr < this.indices.length &&
                this.curr < MAX_OCCURRENCES
            ) {
                this.consumeExcerpt();
            }
        }
        return [...this.excerpts];
    }
}
