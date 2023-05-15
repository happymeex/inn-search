import express from "express";
import path from "path";
import { search } from "./search";
import { writeAll, writeUpdate } from "./webScrape";
import { StatusCodes } from "http-status-codes";
import { SearchParams } from "./score";
import { Request, Response } from "express";
import { resetText } from "./preprocessing";

const PORT = 3000;

const app = express();

app.get("/", (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, "..", "index.html"));
});

type SearchRequest = {
    query: string;
    caseSensitive: string;
};

async function searchHandler(
    req: Request<{}, {}, {}, SearchRequest>,
    res: Response
) {
    const query = req.query.query;
    const caseSensitive = req.query.caseSensitive === "true";
    const allData = await search(query.split(","), {
        caseSensitive: caseSensitive,
    });
    const data = allData.filter((ch) => ch.score > 0);
    // data.sort((ch1, ch2) => ch2[1].score - ch1[1].score);
    res.status(StatusCodes.OK).send(data);
}

/**
 * API endpoint: request must have `query` field
 */
app.get("/search", searchHandler);

const staticPath = path.resolve(__dirname, "..");
app.use(express.static(staticPath));

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
    //resetText(true);
});
