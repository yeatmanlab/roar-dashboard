import store from 'store2';

export const sessionSet = (key, val) => {
  store.session.set(key, val);
};

export const sessionGet = (key) => store.session.get(key);

export const sessionHas = (key) => store.session.has(key);

export const sessionChangeValNum = (key, change) => {
  const val = sessionGet(key);
  sessionSet(key, val + change);
};
