# Search Pagination Design

## Goal

Restore the legacy in-game search behavior without bringing back the legacy monolith or its database features.

## Scope

- Game private-command search displays five songs per page.
- Search replies are sent 150 milliseconds apart.
- Search reply batches run through one global serial queue.
- A queued or running search batch for the same player is dropped.
- Each completed search batch holds the queue for ten seconds.
- Pagination shows the current page, up to four nearby page commands, and previous/next commands when those pages exist.
- Flutter's local song-library search remains at ten songs per page.

## Behavior

`#search <keyword>` opens page one. `#search <keyword>,<page>` opens the requested page, clamped by the song library. Results retain the current `relativePath | #play <relativePath>` command text.

The private reply batch is a search header, result count, five or fewer song rows, current-page text, a four-page command window, and previous/next commands. Each sent message has a 150 millisecond delay before the next one. Single-page result sets omit pagination messages.

When a search request arrives while the same player's search batch is queued or running, it does not run and the player receives one `Search already in progress.` private reply. Search batches from different players remain serialized so the Bot does not issue interleaved bursts.

## Safety And Verification

The existing BotManager remains responsible for owner-only command dispatch. The queue does not alter path validation, playback, Flutter UI search, or other commands. Tests cover five-result pages, reply pacing through an injected sleeper, page command window, previous/next bounds, duplicate-player request rejection, and preservation of Flutter's ten-result search page size.
