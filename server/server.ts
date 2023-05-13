import express from "express";
import path from "path";
import { search } from "./search";
import { writeAll, writeUpdate } from "./webScrape";
import { StatusCodes } from "http-status-codes";
import { SearchParams } from "./score";
import { Request, Response } from "express";

const PORT = 3000;

const app = express();

app.get("/", (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, "..", "index.html"));
});

type SearchRequest = {
    query: string[];
    params: SearchParams;
};

async function searchHandler(
    req: Request<{}, {}, {}, SearchRequest>,
    res: Response
) {
    const query = req.query["query"];
    const params = req.query["params"];
    console.log(query, params);
    res.status(StatusCodes.OK).send("<p>nice</p>");
    //const data = await search(query, params);
    //data.sort((ch1, ch2) => ch2[1].score - ch1[1].score);
    //res.status(StatusCodes.OK).send(
    //    data.map(([name, { score, excerpts }]) => {
    //        return { name, excerpts };
    //    })
    //);
}

/**
 * API endpoint: request must have `query` field
 */
app.get("/search", searchHandler);

const staticPath = path.resolve(__dirname, "..");
app.use(express.static(staticPath));

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
