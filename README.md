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

next, make a file called `config.json` and fill it out as below
```json
{
  "boardId": <Trello ID here>,
  "categoryLists": {
    "1": <Trello ID here>,
    "2": <Trello ID here>,
    "3": <Trello ID here>,
    "4": <Trello ID here>,
    "5": <Trello ID here>
  },
  "customFields": {
    "isBeginner": <Trello ID here>,
    "days": <Trello ID here>,
    "tags": <Trello ID here>,
    "instances": <Trello ID here>,
    "googleId": <Trello ID here>,
    "isCode": <Trello ID here>,
    "isDesign": <Trello ID here>,
    "isDocs": <Trello ID here>,
    "isQa": <Trello ID here>,
    "isOutResearch": <Trello ID here>
  },
  "callbackUrl": <Trello ID here>,
  "botMemberId": <Trello ID here>,
  "defaults": {
    "days": 3,
    "isBeg": false,
    "maxInst": 1
  }
}
```

then simply run. You can edit the methods in `app.js` to change where the tasks are read from and where they are written to.


At the moment they are read from GCI, then overwritten with Trello and finally written back to GCI