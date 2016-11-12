/*<Event Page to direct events called from content scripts>
 Copyright (C) <2015>  <Kyle Szombathy>

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


// Retrieves copy of RMP HTML and parses with regex (I know I know I should have used an xml parser)
chrome.runtime.onMessage.addListener(function(request, sender, callback) {
    var xhr = new XMLHttpRequest();

    chrome.pageAction.show(sender.tab.id); //TODO: Does this have to be here

    // Open URL
    xhr.open('GET', request.url, true);

    // If URL retrieval is error callback with null
    xhr.onerror = function() {
        callback();
    };

    xhr.onreadystatechange = function() {
        var debugging = request.debug;
        // If xhr is ready
        if (xhr.readyState == 4) {

            /*The information scraped here is being parsed by regex instead of a traditional xml parser.
            * This is because when I wrote this I didn't know what I was doing. TODO...*/

            var requestedPageHtmlString = xhr.responseText; // Entire page source as string
            var requestedPageHtml = document.createElement( 'html' );
            requestedPageHtml.innerHTML = requestedPageHtmlString;

            // If url is teacher search page, find the URL of the professor and return it.
            if (request.step === 0) {
                var potentialProfLinks = $( "a[href^='/ShowRatings.jsp?tid=']" , requestedPageHtml);
                console.dir(potentialProfLinks);

                if(potentialProfLinks.length === 1) {
                    if (potentialProfLinks[0].search != undefined) {
                        var profLink = "http://www.ratemyprofessors.com/ShowRatings.jsp" + potentialProfLinks[0].search; // adds something like "?tid=919185" to the URL
                        console.log("Professor Link found: " + profLink);
                        callback(profLink);
                    } else {
                        console.error("Professor Link undefined for url: " + request.url);
                        console.dir(potentialProfLinks);
                    }
                } else {
                    console.error("Multiple professor links found for url: " + request.url);
                    callback();
                }
            }

            // If url is profURL
            else {
                /**Rating array consists of:
                 * 0. Overall Quality
                 * 1. Would take again
                 * 2. Level of difficulty
                 * 3. Hotness
                 * 4+. Tags
                 * @type {Array}
                 */
                var ratingArray = [];
                var replaceRegex = /[^\w\d\.\/%]/g;

                // Overall Quality
                ratingArray[0] = getElementTextByXpath(requestedPageHtml, '//*[@id="mainContent"]/div[1]/div[2]/div[1]/div/div[1]/div/div/div').replace(replaceRegex,'');

                // Would take again
                ratingArray[1] = getElementTextByXpath(requestedPageHtml, '//*[@id="mainContent"]/div[1]/div[2]/div[1]/div/div[2]/div[1]/div').replace(replaceRegex,'');

                // Level of difficulty
                ratingArray[2] = getElementTextByXpath(requestedPageHtml, '//*[@id="mainContent"]/div[1]/div[2]/div[1]/div/div[2]/div[2]/div').replace(replaceRegex,'');

                function getElementTextByXpath(context, xpath) {
                    try {
                        return document.evaluate( xpath , context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null ).singleNodeValue.textContent;
                    } catch (e) {
                        if (e instanceof TypeError) {
                            console.error("Null/ TypeError Caught, returning null");
                            callback("No Ratings");
                        }
                        console.error("Error found " + e.message);
                        callback();
                    }

                }

                /**
                 * Hotness
                 * Potential image src's:
                 * 'cold-chili.png' == 0 and 'new-hot-chili.png' == 1
                 * @type {string}
                 */
                var hotnessSrcText = document.evaluate( '//*[@id="mainContent"]/div[1]/div[2]/div[1]/div/div[2]/div[3]/div/figure/img' ,requestedPageHtml, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null ).singleNodeValue.getAttribute("src");
                if(hotnessSrcText == 'new-hot-chili.png') ratingArray[3] = "Yes";
                else ratingArray[3] = false;

                /**
                 * Tags
                 * Loop through
                 * @type {{tags: Array}}
                 */
                var tagsHolder = {tags:[]};
                var tagClasses = requestedPageHtml.getElementsByClassName("tag-box-choosetags");
                for(var tagClassIndex = 0; tagClassIndex < tagClasses.length; tagClassIndex++) {
                    tagsHolder.tags.push(tagClasses[tagClassIndex].textContent.trim());
                }
                ratingArray[4] = tagsHolder;

                if(debugging > 0) console.dir(ratingArray);
                callback(ratingArray);
            }
        }
    };

    xhr.send();

    return true; // prevents the callback from being called too early on return
    
});