"use strict";

const en = require("../locales/en");
const es = require("../locales/es");

const MESSAGES = { en, es };
const DEFAULT_LANGUAGE = "en";

function normalizeLanguage(language) {
  if (!language) return DEFAULT_LANGUAGE;
  const lang = language.split("-")[0].toLowerCase();
  return MESSAGES[lang] ? lang : DEFAULT_LANGUAGE;
}

function getValue(obj, path) {
  return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function interpolate(template, vars) {
  if (typeof template !== "string") return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : `{{${key}}}`));
}

function t(language, key, vars = {}) {
  const lang = normalizeLanguage(language);
  const message = getValue(MESSAGES[lang], key) ?? getValue(MESSAGES[DEFAULT_LANGUAGE], key);
  if (message === undefined) {
    console.warn(`[music-i18n] Missing key: ${key} for language: ${lang}`);
    return key;
  }
  return interpolate(message, vars);
}

module.exports = { t, normalizeLanguage, DEFAULT_LANGUAGE };
