const DONATE_TEMPLATE_MESSAGE = "{{donateMessageText}}";
const SPONSOR_TEMPLATE_MESSAGE = "{{sponsorMessageText}}";
const SPONSOR_GIFT_TEMPLATE_MESSAGE = "{{sponsorGiftMessageText}}";
const RAID_TEMPLATE_MESSAGE = "{{raidMessageText}}";
const RAID_VIEWER_COUNT_DEFAULT = "{{raidViewerCountDefault}}";

/* ================================================================================================================== */

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
    /** @type {string} */
    let enrichedText = text;
    if(enrichedText.includes('{if_platform')) {
        console.log('Enriching message with data:', enrichedText);
    }

    for (const [rawKey, value] of Object.entries(data)) {
        const key = `{${rawKey}}`;
        const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();

        if (rawKey === "tier") {
            enrichedText = enrichedText.replaceAll(key, parseTierName(data.platform, value));
            enrichedText = enrichedText.replaceAll(snakeKey, parseTierName(data.platform, value));
        } else if (rawKey === "platform") {
            enrichedText = enrichedText.replaceAll(key, value);
            enrichedText = enrichedText.replaceAll(snakeKey, value);
            enrichedText = enrichedText.replace(platformConditionalRegExp, (match, platforms, option1, option2) => {
                const [platform1, platform2] = platforms.split(',').map(p => p.trim());
                
                if (value === platform1.trim()) {
                    return option1;
                } else if (value === platform2.trim()) {
                    return option2;
                }

                return match;
            });
        } else if (rawKey === "viewerCount") {
            enrichedText = enrichedText.replaceAll(key, value > 1 ? value : RAID_VIEWER_COUNT_DEFAULT);
            enrichedText = enrichedText.replaceAll(snakeKey, value > 1 ? value : RAID_VIEWER_COUNT_DEFAULT);
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
});

window.addEventListener("unichat:event", function ({ detail: event }) {
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
            htmlTemplate = htmlTemplate.replace("{donate_meta}", enrichMessage(DONATE_TEMPLATE_MESSAGE, data));
        } else if (event.type === "unichat:sponsor") {
            /** @type {import("../unichat").UniChatEventSponsor['data']} */
            const data = event.data;

            htmlTemplate = enrichMessage(SPONSOR_TEMPLATE, data);
            htmlTemplate = htmlTemplate.replace("{sponsor_meta}", enrichMessage(SPONSOR_TEMPLATE_MESSAGE, data));
        } else if (event.type === "unichat:sponsor_gift") {
            /** @type {import("../unichat").UniChatEventSponsorGift['data']} */
            const data = event.data;

            htmlTemplate = enrichMessage(SPONSOR_GIFT_TEMPLATE, data);
            htmlTemplate = htmlTemplate.replace("{sponsor_gift_meta}", enrichMessage(SPONSOR_GIFT_TEMPLATE_MESSAGE, data));
        } else if (event.type === "unichat:raid") {
            /** @type {import("../unichat").UniChatEventRaid['data']} */
            const data = event.data;

            htmlTemplate = enrichMessage(RAID_TEMPLATE, data);
            htmlTemplate = htmlTemplate.replace("{raid_meta}", enrichMessage(RAID_TEMPLATE_MESSAGE, data));
        }

        if (htmlTemplate != null && MAIN_CONTAINER.querySelector(`div[data-id="${event.data.messageId}"]`) == null) {
            $(MAIN_CONTAINER).append(htmlTemplate);
        }
    }

    requestAnimationFrame(removeChildren);
});
