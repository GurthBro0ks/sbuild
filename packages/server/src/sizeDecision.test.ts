import test from "node:test";
import assert from "node:assert/strict";
import { decideImageSize } from "@sbuild/shared";

test("decideImageSize hero/background defaults", () => {
  const d = decideImageSize({ blockType: "hero", usage: "heroBackground" });
  assert.equal(d.providerSize, "1536x1024");
  assert.equal(d.outputWidth, 1536);
  assert.equal(d.outputHeight, 864);
  assert.equal(d.cropMode, "cover");
});

test("decideImageSize card and gallery defaults", () => {
  const card = decideImageSize({ blockType: "card", usage: "cardImage" });
  assert.equal(card.providerSize, "1024x1024");
  assert.equal(card.outputWidth, 1024);
  assert.equal(card.outputHeight, 1024);

  const gallery = decideImageSize({ blockType: "gallery", usage: "galleryItem", aspectRatioHint: "4:3" });
  assert.equal(gallery.providerSize, "1536x1024");
  assert.equal(gallery.outputWidth, 1024);
  assert.equal(gallery.outputHeight, 768);
});

test("decideImageSize logo/favicon defaults", () => {
  const logo = decideImageSize({ blockType: "navLogo", usage: "logo" });
  assert.equal(logo.providerSize, "1024x1024");
  assert.equal(logo.cropMode, "contain");

  const favicon = decideImageSize({ blockType: "favicon", usage: "favicon" });
  assert.equal(favicon.providerSize, "1024x1024");
  assert.equal(favicon.outputWidth, 512);
  assert.equal(favicon.outputHeight, 512);
});

test("decideImageSize socialOg and unknown defaults", () => {
  const social = decideImageSize({ blockType: "unknown", usage: "socialOg" });
  assert.equal(social.providerSize, "1536x1024");
  assert.equal(social.outputWidth, 1200);
  assert.equal(social.outputHeight, 630);

  const unknown = decideImageSize({ blockType: "unknown", usage: "custom" });
  assert.equal(unknown.providerSize, "1024x1024");
  assert.equal(unknown.outputWidth, 1024);
  assert.equal(unknown.outputHeight, 1024);
});
