# Task Syncer
Syncs tasks between Trello and Google.

## Usage
You will need `request`, `request-promise` and `bluebird` all of which are included in the package.json
Make a json file called tokens.json in the root directory with the following structure:
```json
{
  "googleToken": "google api token",
  "trelloKey": "trello api key",
  "trelloToken": "trello oauth2 api token"
}
```

then simply run. You can edit the methods in `app.js` to change where the tasks are read from and where they are written to.


At the moment they are read from GCI, then overwritten with Trello and finally written back to GCI