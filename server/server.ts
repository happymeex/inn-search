import express from "express";
import path from "path";
import { search } from "./search";
import { writeAll, writeUpdate } from "./webScrape";

const PORT = 3000;

const app = express();

app.get("/", (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, "..", "index.html"));
});

const staticPath = path.resolve(__dirname, "dist");
app.use(express.static(staticPath));

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});

async function f() {
    const res = await search("youtube", {
        caseSensitive: false,
    });
    for (const chapter of res) {
        const [name, data] = chapter;
        console.log(name, "score:", data.score);
        console.log("excerpts:", data.excerpts.slice(0, 5));
    }
}

void f();

//void writeAll(15, 5);

//writeUpdate();
