const MAIN_CONTAINER = document.querySelector("#main-container");
const MESSAGE_TEMPLATE = document.querySelector("#chatlist_item").innerHTML;
const DONATE_TEMPLATE = document.querySelector("#donate_item").innerHTML;
const SPONSOR_TEMPLATE = document.querySelector("#sponsor_item").innerHTML;
const SPONSOR_GIFT_TEMPLATE = document.querySelector("#sponsor-gift_item").innerHTML;
const RAID_TEMPLATE = document.querySelector("#raid_item").innerHTML;

function buildBadges(badges) {
    let badgeJoin = ''

    for (const badge of badges) {
        badgeJoin+=`<img src="${badge.url}" class="badge" />`
    }

    return badgeJoin;
}

function buildMessage(message, emotes) {
    if (message == null || typeof message !== "string" || message.trim().length === 0) {
        return "";
    }

    let safeMessage = (message ?? "").replace(/\</g, '&lt;').replace(/\>/g, '&gt;');
    if (!emotes || !Array.isArray(emotes) || emotes.length === 0) {
        return safeMessage;
    }

    const emotesMap = new Map(emotes.map(emote => [emote.code, emote.url]));
    const processedWords = safeMessage.split(' ').map(word => {
        const emoteUrl = emotesMap.get(word);
        return emoteUrl ? `<img src="${emoteUrl}" />` : word;
    });

    return processedWords.join(' ');
}

function parseTierName(platform, tier) {
    if (platform === "twitch" && tier.toLowerCase() !== "prime") {
        return parseInt(tier, 10) / 1000
    }

    return tier;
}

const platformConditionalRegExp = /\{if_platform\(([^)]+)\)::([^:}]*)::([^:{}]*)\}/g;
function enrichMessage(text, data) {
    let enrichedText = text;

    for (const [rawKey, value] of Object.entries(data)) {
        const key = `{${rawKey}}`;
        const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();

        if (rawKey === "tier") {
            enrichedText = enrichedText.replaceAll(key, parseTierName(data.platform, value));
            enrichedText = enrichedText.replaceAll(snakeKey, parseTierName(data.platform, value));
        } else if (rawKey === "platform") {
            enrichedText = enrichedText.replaceAll(key, value);
            enrichedText = enrichedText.replaceAll(snakeKey, value);
        } else if (rawKey === "viewerCount") {
            enrichedText = enrichedText.replaceAll(key, value > 1 ? value : "{{raidViewersDefaultText}}");
            enrichedText = enrichedText.replaceAll(snakeKey, value > 1 ? value : "{{raidViewersDefaultText}}");
        } else if (rawKey === "messageText") {
            enrichedText = enrichedText.replaceAll(key, buildMessage(value, data.emotes));
            enrichedText = enrichedText.replaceAll(snakeKey, buildMessage(value, data.emotes));
        } else if (rawKey === "authorBadges") {
            enrichedText = enrichedText.replaceAll(key, buildBadges(value));
            enrichedText = enrichedText.replaceAll(snakeKey, buildBadges(value));
        } else {
            enrichedText = enrichedText.replaceAll(key, value);
            enrichedText = enrichedText.replaceAll(snakeKey, value);
        }
    }

    return enrichedText;
}

function removeChildren() {
    if(MAIN_CONTAINER.children.length > 50) {
        MAIN_CONTAINER.firstChild.remove();
        requestAnimationFrame(removeChildren);
    }
}

// Dispatch every time when websocket is connected (or reconnected)
window.addEventListener("unichat:connected", function () {
    // This listener doesn't receive any data, actually it just notifies
    // that connection is established or re-established.

    const exitDelay = parseInt("{{exitDelay}}", 10);
    if (exitDelay > 0 && !MAIN_CONTAINER.classList.contains("with-exit-animation")) {
        MAIN_CONTAINER.classList.add("with-exit-animation");
    }
});

window.addEventListener("unichat:event", function ({ detail: event }) {
    const platformBadgesEnabled = "{{platformBadge}}" === "true";

    if (platformBadgesEnabled && event != null && event.data != null && Array.isArray(event.data.authorBadges)) {
        let imgUrl;
        if (event.data.platform === "youtube") {
            imgUrl = `${window.location.pathname}/assets/platform_badge_youtube.png`;
        } else if (event.data.platform === "twitch") {
            imgUrl = `${window.location.pathname}/assets/platform_badge_twitch.png`;
        }

        if (imgUrl != null) {
            event.data.authorBadges.unshift({ code: "platform", url: imgUrl })
        }
    }

    if (event.type === 'unichat:remove_message') {
        /** @type {import("../unichat").UniChatEventRemoveMessage['data']} */
        const data = event.data;
        MAIN_CONTAINER.querySelector(`div[data-id="${event.data.messageId}"]`)?.remove();
    } else if (event.type === 'unichat:remove_author') {
        /** @type {import("../unichat").UniChatEventRemoveAuthor['data']} */
        const data = event.data;
        const messages = MAIN_CONTAINER.querySelectorAll(`div[data-from="${data.authorId}"]`);
        for (const message of (messages ?? [])) {
            message.remove();
        }
    } else if (event.type === 'unichat:clear') {
        MAIN_CONTAINER.innerHTML = '';
    } else {
        let htmlTemplate;

        if (event.type === "unichat:message") {
            /** @type {import("../unichat").UniChatEventMessage['data']} */
            const data = event.data;

            htmlTemplate = enrichMessage(MESSAGE_TEMPLATE, data);
        } else if (event.type === "unichat:donate") {
            /** @type {import("../unichat").UniChatEventDonate['data']} */
            const data = event.data;

            htmlTemplate = enrichMessage(DONATE_TEMPLATE, data);
            htmlTemplate = htmlTemplate.replace("{donate_meta}", enrichMessage("{{donateTemplateMessage}}", data));
        } else if (event.type === "unichat:sponsor") {
            /** @type {import("../unichat").UniChatEventSponsor['data']} */
            const data = event.data;

            htmlTemplate = enrichMessage(SPONSOR_TEMPLATE, data);
            htmlTemplate = htmlTemplate.replace("{sponsor_meta}", enrichMessage("{{sponsorTemplateMessage}}", data));
        } else if (event.type === "unichat:sponsor_gift") {
            /** @type {import("../unichat").UniChatEventSponsorGift['data']} */
            const data = event.data;

            htmlTemplate = enrichMessage(SPONSOR_GIFT_TEMPLATE, data);
            htmlTemplate = htmlTemplate.replace("{sponsor_gift_meta}", enrichMessage("{{sponsorGiftTemplateMessage}}", data));
        } else if (event.type === "unichat:raid") {
            /** @type {import("../unichat").UniChatEventRaid['data']} */
            const data = event.data;

            htmlTemplate = enrichMessage(RAID_TEMPLATE, data);
            htmlTemplate = htmlTemplate.replace("{raid_meta}", enrichMessage("{{raidTemplateMessage}}", data));
        }

        if (htmlTemplate != null && MAIN_CONTAINER.querySelector(`div[data-id="${event.data.messageId}"]`) == null) {
            $(MAIN_CONTAINER).append(htmlTemplate);
        }
    }

    requestAnimationFrame(removeChildren);
});
