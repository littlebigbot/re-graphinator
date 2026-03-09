# Ideas / Backlog

## Degrees of Separation

Find the shortest chain connecting two people who share no direct credits,
hopping through shared projects. Classic Kevin Bacon problem.

- Use BFS; bail early once a path is found
- Needs aggressive caching — can fan out exponentially for obscure pairings
- Rate limiting will be the main constraint
