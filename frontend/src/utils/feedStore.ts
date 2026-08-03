// In-memory share of the last known feed so the story viewer can render
// instantly after tapping a ring (the feed already fetched + cached it) while
// a background refresh updates the data.
export type StoryGroup = { user: any; stories: any[] };

let feedStories: StoryGroup[] | null = null;

export const setFeedStories = (stories: StoryGroup[] | null) => {
  feedStories = stories;
};

export const getFeedStories = (): StoryGroup[] | null => feedStories;
