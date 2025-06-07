// src/utils/db-helper.js
import { openDB } from 'idb';

const DB_NAME = 'story-app-db';
const STORY_STORE_NAME = 'stories';
const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORY_STORE_NAME, { keyPath: 'id' });
  },
});

const StoryDb = {
  async getStories() {
    return (await dbPromise).getAll(STORY_STORE_NAME);
  },
  async putStory(story) {
    if (!story.id) return;
    return (await dbPromise).put(STORY_STORE_NAME, story);
  },
  async putAllStories(stories) {
    const tx = (await dbPromise).transaction(STORY_STORE_NAME, 'readwrite');
    stories.forEach(story => tx.store.put(story));
    return tx.done;
  },
  async deleteStory(id) {
    return (await dbPromise).delete(STORY_STORE_NAME, id);
  },
};

export default StoryDb;