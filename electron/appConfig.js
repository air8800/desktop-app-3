"use strict";

const path = require("path");
const { app } = require("electron");

const APP_NAME = "PrintGet Shop Manager";
const APP_ID = "com.printget.shopmanager";
const OAUTH_PROTOCOL = "printget";

const isProduction = app.isPackaged;

function getRendererIndexPath() {
  return path.join(__dirname, "..", "dist", "index.html");
}

function getPreloadPath() {
  return path.join(__dirname, "preload.js");
}

function getWindowIconPath() {
  const iconName = process.platform === "win32" ? "icon.ico" : "icon.png";
  return path.join(__dirname, "assets", iconName);
}

function getExtraResourcesPath() {
  return isProduction
    ? path.join(process.resourcesPath, "extraResources")
    : path.join(__dirname, "..", "extraResources");
}

module.exports = {
  APP_NAME,
  APP_ID,
  OAUTH_PROTOCOL,
  isProduction,
  getRendererIndexPath,
  getPreloadPath,
  getWindowIconPath,
  getExtraResourcesPath,
};
