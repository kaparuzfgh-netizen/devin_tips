import { api } from 'sdk';

// runs on each `callback_query` update
export default async function (callback_query, ctx) {
  await api.answerCallbackQuery({
    callback_query_id: callback_query.id,
  });
}