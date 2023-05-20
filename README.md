# Search The Wandering Inn

This is a search website for ✨[The Wandering Inn]("https://wanderinginn.com")✨,
a great fantasy LitRPG webnovel. It's got memorable characters, expansive worldbuilding, and a gripping story
full of magic and monsters. You should check it out!

I started developing this site while the webnovel's own
search function was broken. It has since been fixed, but I
figured I could improve the UI/UX so I built this site
anyways. Here are some features:

-   Search results with keyword-highlighted excerpts
-   Sorting search results by relevance or by chronology
-   A few Easter eggs...?

I am going to try to deploy this soon.

## Development

This repository contains the source code for both the web client and the server.
The code was developed and tested in Ubuntu.

To develop locally: first clone and `npm install`. Then make a `.env`
file in the root directory containing a line `ADMIN_KEY=[password]`, where `[password]`
is a string of your choosing.
Run `npm start` to compile and start the server.
If the server has not already fetched the webnovel text and written it to disk, it will do so.
This should take a few hours; the console will notify you when it is finished.
(It fetches in batches of 20 every 5 minutes to avoid a 429 response from
the TWI web server. You can adjust these parameters by playing with the constants in `server/preprocessing.ts`.)
Subsequent server starts bypass the webscraping step and instead load the data into memory by reading
from disk.

To see the frontend, visit `https://localhost:3000/` in your browser.
If you make changes to the client, run `npm run copy` before visiting the site again.

While the server is running, you can issue admin commands:
To reset the server to refetch and update its copy of the text data, make a GET request (e.g. using your browser) to

```
https://localhost:3000/admin?password=[password]&command=reset
```

To fetch and update the data when a new chapter is released, make a GET request to

```
https://localhost:3000/admin?password=[password]&command=update
```
