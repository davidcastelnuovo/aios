(function () {
  var VCARD_URL = "https://pdpsagot.co.il/wp-content/uploads/danny-pick-en.vcf";

  function shareText() {
    return (
      "Danny Pick\n" +
      "+972 52-379-5155\n" +
      "danny@pdpsagot.co.il\n\n" +
      "Save contact:\n" +
      VCARD_URL
    );
  }

  function openWhatsAppText(text) {
    var url = "https://wa.me/?text=" + encodeURIComponent(text);
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = url;
        return;
      }
    } catch (err) {}
    window.location.href = url;
  }

  function whenBackFromShare() {
    return new Promise(function (resolve) {
      var sawHidden = document.visibilityState === "hidden";
      var settled = false;
      var earlyTimer = 0;
      function finish() {
        if (settled) return;
        settled = true;
        document.removeEventListener("visibilitychange", onChange);
        window.clearTimeout(earlyTimer);
        window.setTimeout(resolve, 200);
      }
      function onChange() {
        if (document.visibilityState === "hidden") {
          sawHidden = true;
          window.clearTimeout(earlyTimer);
          return;
        }
        if (sawHidden) finish();
      }
      document.addEventListener("visibilitychange", onChange);
      earlyTimer = window.setTimeout(function () {
        if (!sawHidden && document.visibilityState === "visible") finish();
      }, 800);
    });
  }

  function pinShareButton() {
    document.querySelectorAll(".share-dock").forEach(function (dock) {
      dock.style.setProperty("position", "relative", "important");
      dock.style.setProperty("width", "46%", "important");
      dock.style.setProperty("margin-left", "0", "important");
      dock.style.setProperty("margin-right", "auto", "important");
      dock.style.setProperty("text-align", "left", "important");
      dock.style.setProperty("float", "none", "important");
    });
    document.querySelectorAll(".js-share-card").forEach(function (link) {
      link.style.setProperty("position", "static", "important");
      link.style.setProperty("left", "auto", "important");
      link.style.setProperty("right", "auto", "important");
      link.style.setProperty("bottom", "auto", "important");
      link.style.setProperty("float", "none", "important");
      link.style.setProperty("margin", "0", "important");
    });
  }

  pinShareButton();
  window.addEventListener("resize", pinShareButton);

  document.querySelectorAll(".js-save-contact").forEach(function (link) {
    link.setAttribute("href", VCARD_URL);
    link.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.href = VCARD_URL;
    });
  });

  function bgUrl() {
    var root = document.querySelector(".danny-pik-vcard");
    var raw = root ? getComputedStyle(root).getPropertyValue("--card-bg-url") : "";
    raw = (raw || "").trim().replace(/^url\((.*)\)$/i, "$1").replace(/^["']|["']$/g, "");
    return raw || "/idcard/card-bg.png";
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  async function cardFile() {
    if (document.fonts && document.fonts.load) {
      await document.fonts.load("800 96px Heebo");
      await document.fonts.load("800 58px Heebo");
      await document.fonts.load("800 48px Heebo");
    }
    var img = await loadImage(bgUrl());
    var canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 676;
    var ctx = canvas.getContext("2d");
    var scale = Math.max(canvas.width / img.width, canvas.height / img.height);
    var w = img.width * scale;
    var h = img.height * scale;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    ctx.fillStyle = "#0f4c81";
    ctx.textAlign = "right";
    ctx.direction = "ltr";
    ctx.font = "800 96px Heebo, sans-serif";
    ctx.fillText("Danny Pick", 1140, 210);
    ctx.fillStyle = "#c4a574";
    ctx.fillRect(1028, 242, 112, 5);
    ctx.fillStyle = "#0f4c81";
    ctx.direction = "ltr";
    ctx.font = "800 58px Heebo, sans-serif";
    ctx.fillText("+972 52-379-5155", 1140, 350);
    ctx.font = "800 48px Heebo, sans-serif";
    ctx.fillText("danny@pdpsagot.co.il", 1140, 430);
    var blob = await new Promise(function (resolve) {
      canvas.toBlob(resolve, "image/jpeg", 0.9);
    });
    return new File([blob], "danny-pik.jpg", { type: "image/jpeg" });
  }

  document.querySelectorAll(".js-share-card").forEach(function (link) {
    link.addEventListener("click", async function (event) {
      event.preventDefault();
      var file = null;
      try {
        file = await cardFile();
      } catch (err) {
        file = null;
      }
      var text = shareText();
      var android = /Android/i.test(navigator.userAgent || "");
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: text });
          if (android) {
            await whenBackFromShare();
            openWhatsAppText(text);
          }
          return;
        } catch (err) {
          if (err && err.name === "AbortError") return;
        }
      }
      openWhatsAppText(text);
    });
  });
})();
