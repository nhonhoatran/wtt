import { MAX_INFO_BODY } from '../../modules/events/event-dtos.js';

/** infoBody + infoBodyEn are the largest JSON payload; a client may escape every character as \uXXXX (6 bytes). */
const BYTES_PER_CHAR_WORST_CASE = 6;
const RICH_TEXT_FIELDS_PER_REQUEST = 2;
/** Room for the remaining short fields and JSON syntax. */
const OTHER_FIELDS_ALLOWANCE_BYTES = 64 * 1024;

/** Express default is 100kb, which rejects long Vietnamese rich text before validation runs. */
export const JSON_BODY_LIMIT =
  MAX_INFO_BODY * RICH_TEXT_FIELDS_PER_REQUEST * BYTES_PER_CHAR_WORST_CASE + OTHER_FIELDS_ALLOWANCE_BYTES;
