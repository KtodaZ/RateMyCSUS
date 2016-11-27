/*<Content Script for main processes of extension>
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

/**
 * Note to reader: this script needs some work to make it cleaner as I wrote it when I was new to programming
 * If you are trying to implement this for you school, feel free to contact me if you have any questions.
 */

var extensionName = "RateMyCSUS";
var rmpSchoolUrl = 'California+State+University%2C+Sacramento'; // The school URL for the RMP search page
var exclusions = ["TBA", "Online", "Fee", "Web", "Arranged", "StaffStaff"]; // Do not search these teacher names
var iframeObject = $("#ptifrmtgtframe");    //The object the iframe is found in
var timers = [];                            // array to hold timer objects
var debugging = 0;                          // 0 - very basic messages, 1 - basic messages, 2 - all messages
var profIDPrefix = 'profID';                // A custom ID
var timerWaitVal = 2500;                    // The amount of milliseconds for the timers to loop/wait
var profIDContains = "INSTR";               // All professor ID's on the Student Center have this prefix
var profClass = "PSLONGEDITBOX";            // All profNames have this class


// Entry point
main();

function main() {
    // document.ready probably isn't needed because chrome handles the action for you
    // but I could be wrong so i'm leaving it
    $(document).ready(function () {
        initScript();
        checkIframe();
    });
}

function initScript() {
    console.clear();
    log(extensionName + " Running");

    // Send a message to background script in order to show page action
    // I don't remember if this was needed for something, or if I was testing a new feature
    chrome.runtime.sendMessage({greeting: "show_page_action"});
}

/**
 * Sac state's student center displays all content in iframes that take up a majority of the window space
 * There is no function I could find that automatically can detect when the iframe changes and because the page
 * URL sometimes does not change, we need to use timers in order to detect these changes.
 * There might be a better solution to this using listeners or some type of other solution.
 * If the function detects a change, it pulls the html content of the iframe out, and uses detectAndAggregateProfessors
 * to check if the page contains teacher names. If so, detectAndAggregateProfessors runs.
 */
function checkIframe() {
    var iframeBodyObj, iframeBodyHtml;

    if (debugging>0) log("Scanning page for professors");

    clearTimers();
    removeGhostTooltips();
    updateIframeBody();

    var iframeBodyClone = getIframeBodyClone();

    var t0 = performance.now(); // For estimating page load

    // If page contains names, returns edited HTML, else returns false
    var editedIframeHtml = detectAndAggregateProfessors(iframeBodyClone);

    if (editedIframeHtml /*true if Edited HTML exists, false if boolean false*/) {
        replaceIframeHtml(editedIframeHtml);
        initPageChangedTimer();
        log("Professors found, script executed. Script load took " + (performance.now() - t0) + " milliseconds.");
    } else {
        // Waits x seconds to check page again
        timers.push(setTimeout(function () {
            checkIframe();
        }, timerWaitVal));
    }



    // Clears all timers so there is only one instance of the timers running at a time
    function clearTimers() {
        for (var i = 0; i < timers.length; i++) {
            clearTimeout(timers[i]);
        }
    }

    // Removes ghost qtips that my reside after switching pages
    function removeGhostTooltips() {
        $(".qtip").remove();
    }

    // Returns body of iframe
    function updateIframeBody() {
        iframeBodyObj =  $(iframeObject).contents().find("body");
        iframeBodyHtml = $(iframeBodyObj).html();
    }

    // Creates temporary html element to experiment with
    function getIframeBodyClone() {
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = iframeBodyHtml;
        return tempDiv;
    }

    // Replace iframe HTML with new Html
    function replaceIframeHtml(newHtml) {
        try {
            $(iframeBodyObj).html(newHtml);
        } catch (ReferenceError) {
            // Do nothing
        }

    }

    // Scan the page for changes in a timer loop
    function initPageChangedTimer() {
        timers.push(setInterval(function () {
            if (debugging>0) log("Scanning for changes"); // Debugging

            updateIframeBody();

            if (isNewPageLoaded()) {
                if (debugging>0) { log("Page changed. Restarting search."); console.clear(); }
                checkIframe();
            }
        }, timerWaitVal));
    }

    // Returns true if page already contains edited code
    function isNewPageLoaded() {
        // Looks for "link" class in html document to see if our html is injected
        return ($(".link", iframeBodyObj).length == 0);
    }
}

/**
 * Detects if page contains names, if it does, runs script and attaches URL to teacher names and creates initTooltip
 * @param iframeHtml The html of the pages iframe
 * @returns {*} The new page content if teacher names are available and correct
 */
function detectAndAggregateProfessors(iframeHtml) {
    var profIDNum = 0;                       // Counter for number of profs to display custom ID
    var profNameRegex = /^([ ]?\n?([A-Z][a-z]*(\'|\-)?[A-Z]?[a-z]+[ ]?){2,3})?(\nStaff)?$/;
    var profNameArray = [];                     // Array to hold all prof names
    var profLocations = getProfessorPageLocations();

    // Loop through each professor location and assign a link and initiateRMPScrapeOnMouseHover functionality to them
    for (var locationNum = 0; locationNum < profLocations.length; locationNum++) {

        var potentialProfessorsAtLocation = $(profLocations[locationNum]).text().trim().split(/[,]+/);
        var divReplacementForValidProfName = '<div id=\"contentBox\" style=\"margin:0px auto; width:100%\">';

        // Loop through potential names at this location. Sometimes false positives can show up and we want to ignore those.
        for (var potentialNameIndex = 0; potentialNameIndex < potentialProfessorsAtLocation.length; potentialNameIndex++) {
            var isProfFoundAtLocation = false;
            var profName = potentialProfessorsAtLocation[potentialNameIndex].trim();
            var profNameItemized = profName.split(/[\n]+/);
            if (debugging>1) log(profNameItemized);

            // Specific case for double line profs with the same name twice
            if (profNameItemized.length === 2 || profNameItemized.length === 3) {
                var profNamePart1 = profNameItemized[0].trim();
                var profNamePart2 = profNameItemized[1].trim();
                if (profNameItemized.length === 3) profNamePart2 += profNameItemized[2].trim();

                var tempDiv0 = getProfPlaceholderURL(profNamePart1);
                var tempDiv1 = getProfPlaceholderURL(profNamePart2);

                if (tempDiv0 && tempDiv1) {
                    divReplacementForValidProfName += tempDiv0 + '<br>' + tempDiv1;
                    isProfFoundAtLocation = true;
                }
                else continue; // The names are not in the correct format, so skip

            }

            // Specific case for 2 or more teacher names
            else {
                var tempDiv = getProfPlaceholderURL(profName);
                if (tempDiv) {
                    divReplacementForValidProfName += tempDiv;
                    isProfFoundAtLocation = true;
                }
                else continue; // The names are not in the correct format, so skip
            }

            // Add newline as necessary
            if (potentialNameIndex != potentialProfessorsAtLocation.length - 1) {
                divReplacementForValidProfName += ',' + '<br>';
            }


            /**
             * Attach a URL to a professor name
             * @param profName at a certain index
             * @returns {*} The HTML of the link OR false
             */
            function getProfPlaceholderURL(profName) {
                var linkHtml = "";

                // Sometimes multiple professors are listed as one professor, but are actually
                // two and have 'Staff' listed with them. This is okay and we still add this to our content box

                // If index is a 'staff' name
                if (profName.trim().localeCompare("Staff") === 0) {
                    linkHtml += 'Staff';
                }

                // If index is a normal name
                else if (profNameRegex.test(profName) && !isStringArrayInString(exclusions, profName)) {
                    if (debugging>1) log("Regex passed for: " + profName);

                    var staffIndex = profName.indexOf("Staff");

                    // If index contains a normal name AND staff together
                    if (staffIndex !== -1) {
                        linkHtml += '<br>' + profName.substring(staffIndex);
                        profNameArray.push(profName.substring(0, staffIndex));
                    } else {
                        profNameArray.push(profName);
                    }

                    // We need to add a specific ID associated with the link
                    // This link is only a placeholder link that points to a search page.
                    // On the initiateRMPScrapeOnMouseHover function we will load the actual prof URL
                    linkHtml += '<a class="link" id="' + profIDPrefix + profIDNum + '" ' +
                        'href="' + getAllSchoolsURL(profNameArray[profNameArray.length - 1]) +
                        '" target="_blank" title="RMP Search page">' + profName + '</a>';

                    profIDNum++;
                } else return false; // Else it is invalid and no teacher names are present
                return linkHtml;
            }
        } // End potential names for loop

        divReplacementForValidProfName += '</div>';

        if(isProfFoundAtLocation) {
            // Replace cell with html
            $(profLocations[locationNum]).text('');
            profLocations[locationNum].innerHTML = divReplacementForValidProfName;
        }
    } // End locations for loop


    if (profIDNum > 0) {
        for (var professorIndex = 0; professorIndex < profNameArray.length; professorIndex++) {
            // Create initiateRMPScrapeOnMouseHover function
            var profLocation = $('#' + profIDPrefix + professorIndex, iframeHtml);

            initTooltip(profLocation); // Yes this is creating 1 tooltip per professor which increases load times and memory usage. TODO...

            // Call for tooltips and dynamic content load
            initiateRMPScrapeOnMouseHover(profLocation, profNameArray[professorIndex], profNameArray[professorIndex]);
        }

        return iframeHtml;
    }
    else return false; // Return false if no profs are found



    // =============== Functions for detectAndAggregateProfessors ===============
    // Get an array of all professor objects in the page
    function getProfessorPageLocations() {
        return $('[id*="' + profIDContains + '"][class="' + profClass + '"]', iframeHtml);
    }

    // Creates default initTooltip & initTooltip settings
    function initTooltip(profLocation) {
        $(profLocation).qtip({
            content: {
                text: "<div id=\"contentBox\" style=\" padding-right: 10px; width:95%\"> " +
                      "<b>Click</b> the links to view their Rate My Professor page </div>",
                title: "<div id=\"contentBox\" style=\" padding-right: 10px; width:90%\"> " +
                       "<b>Hover</b> over any professor name to view their ratings </div>",
                button: 'close'
            },
            position: {
                target: [700, 115],
                viewport: iframeObject
            },
            style: {
                classes: 'qtip-bootstrap',
                width: 195,
                tip: {
                    corner: false
                }
            },
            show: {
                solo: true,
                ready: true
            },
            hide: {
                event: 'unfocus',
                leave: false,
                fixed: true,
                effect: function (offset) {
                    $(this).fadeOut(200);
                }
            }
        });
    }

    /**
     * Dynamically calls updateProfUrlToRmpPageAndRetrieveRatings on mouse over
     * @param profLocation The specific professor names location
     * @param profNameWithSpace
     */
    function initiateRMPScrapeOnMouseHover(profLocation, profNameWithSpace) {
        var haveProfUrl = false;  // Do not load ratings again if we already have them loaded

        $(profLocation).mouseenter(function () {

            // Checks hyperlink so updateProfUrlToRmpPageAndRetrieveRatings only loads once
            if (!haveProfUrl) {
                $(profLocation).qtip('option', 'content.title', "<div id=\"contentBox\" style=\" padding-right: 10px; width:95%\"> " +
                    "<b>" + profNameWithSpace + "</b></div>");
                $(profLocation).qtip('option', 'content.text', 'Loading . . .');

                updateProfUrlToRmpPageAndRetrieveRatings(profLocation, profNameWithSpace);
                haveProfUrl = true;
            }
        });
    }

    // Uses chrome function to search for professor, gets URL and Ratings
    function updateProfUrlToRmpPageAndRetrieveRatings(profLocation, profNameWithSpace) {
        if (debugging>1) log(profNameWithSpace);

        // Makes call to event page and returns with prof URL
        chrome.runtime.sendMessage({
            debug: debugging,
            step: 0,
            url: getSacStateProfURL(profNameWithSpace)
        }, function (response) {
            var profURL = response;
            if (debugging>0) log("URL retrieved: " + profURL);

            // If a professor is found
            if (profURL != null) {

                // Makes second call to event page to get specific ratings in an array
                chrome.runtime.sendMessage({
                    debug: debugging,
                    step: 1,
                    url: profURL
                }, function (response) {
                    var ratingArray = response;
                    // Derive values from array
                    var ovQuality = ratingArray[0];
                    var wouldTakeAgain = ratingArray[1];
                    var levelOfDifficulty = ratingArray[2];
                    var hotness = ratingArray[3];
                    var tagHolder = ratingArray[4];

                    var iconUrlDown = chrome.extension.getURL("images/down.png");
                    var iconUrlUp = chrome.extension.getURL("images/up.png");

                    var qtipHtml = [];
                    qtipHtml.push('<div id=\"contentBox\" style=\"margin:0px auto; height:100%; width:100%\">');

                    if (ratingArray == "No Ratings" || (ovQuality == "N/A" && wouldTakeAgain == "N/A" && levelOfDifficulty == "N/A" && tagHolder.tags.length == 0)) {
                        qtipHtml.push('This professor has no ratings for Sacramento State. <br>');
                        qtipHtml.push(createQtipLink(getAllSchoolsURL(profNameWithSpace), "Search other schools"));
                        profLocation.title = "Search other schools for " + profNameWithSpace;
                    } else {
                        // Column 1
                        qtipHtml.push('<div id=\"column1\" style=\"float:left; margin:0; width:75%;\">');
                        qtipHtml.push("Overall Quality:<br>Would take again:<br>Level of difficulty:<br>");
                        if(hotness) qtipHtml.push("Hotness:<br>");
                        if(tagHolder.tags.length > 0){
                            qtipHtml.push('<a role="button" data-toggle="collapse" data-parent="#accordion" style="outline:none;" href="#'+profLocation[0].id+'tagsBox" aria-expanded="false" aria-controls="'+profLocation[0].id+'tagsBox">');
                            qtipHtml.push('Tags</a>');
                        }
                        qtipHtml.push('</div>');

                        // Column 2
                        qtipHtml.push('<div id=\"column2\" style=\"float:left; position: absolute; right: 0px; margin:0;width:25%;\">');
                        qtipHtml.push(ovQuality+"<br>"+wouldTakeAgain+"<br>"+levelOfDifficulty);
                        if(hotness) qtipHtml.push("<br>"+hotness);
                        qtipHtml.push('<br style="line-height: 21px;">');
                        if(tagHolder.tags.length > 0) {
                            qtipHtml.push('<input type="image" alt="Submit Form" id="'+profLocation[0].id+'icon" style="outline:none;"  width="20" height="13" data-toggle="collapse" data-target="#'+profLocation[0].id+'tagsBox" src="'+iconUrlDown+'" />');
                        }
                        qtipHtml.push('</div>');

                        // Tags Box
                        if(tagHolder.tags.length > 0) {
                            qtipHtml.push('<div class="panel-group" id="'+profLocation[0].id+'accordion" role="tablist" aria-multiselectable="false" style=\"float:left; display: none; padding-top: 5px; margin:0;width:100%;\">');
                                qtipHtml.push('<div class="panel panel-default">');
                                    qtipHtml.push('<div class="panel-collapse collapse" id="'+profLocation[0].id+'tagsBox" role="tabpanel" aria-labelledby="'+profLocation[0].id+'tagsBox" >');
                                        qtipHtml.push('<div class="panel-body" style="line-height: 10px; padding-top: 2px; padding-bottom: 5px; padding-left: 8px; padding-right: 5px;">');
                                        for(var tagNum = 0; tagNum < tagHolder.tags.length; tagNum++) {
                                            qtipHtml.push('<span style="font-size: x-small; ">');
                                            qtipHtml.push(tagHolder.tags[tagNum]);
                                            qtipHtml.push("</span>");
                                            qtipHtml.push('<br style="line-height:0px;" />');
                                        }
                                        qtipHtml.push('</div>');
                                    qtipHtml.push('</div>');
                                qtipHtml.push('</div>');
                            qtipHtml.push('</div>');
                        }
                        profLocation.title = profNameWithSpace + " on RateMyProfessor";
                    }
                    qtipHtml.push('</div>');

                    $(profLocation).qtip('option', 'content.text', qtipHtml.join(""));
                    $(profLocation).attr("href", profURL);

                    //$('#'+profLocation[0].id+'tagsBox').collapse('toggle');
                    $('#'+profLocation[0].id+'tagsBox').on("hide.bs.collapse", function(){
                        $('#'+profLocation[0].id+'icon').attr('src', iconUrlDown);
                        $('#'+profLocation[0].id+'accordion').hide(); //style="display: none;
                    });
                    $('#'+profLocation[0].id+'tagsBox').on("show.bs.collapse", function(){
                        $('#'+profLocation[0].id+'icon').attr('src', iconUrlUp);
                        $('#'+profLocation[0].id+'accordion').show();
                    });

                    function createQtipLink(url, linkTxt) {
                        return '<a class=\"link\" href=\"' + url + '\" target=\"_blank\" title='+linkTxt+'>' + linkTxt + '</a>';
                    }
                });
            }
            // If no prof is found
            else {
                profURL = getAllSchoolsURL(profNameWithSpace);

                $(profLocation).qtip('option', 'content.text', '<div id=\"contentBox\" style=\"margin:0px auto; height:100%; width:100%\">' +
                    "No professors found. " +
                    '<a class="link" id ="search_schools_link" href="' + profURL + '" target="_blank" title="Search other schools">' +
                    'Search other schools' + '</a>'+
                    '</div>');

                $(profLocation).attr("href", profURL);
                profLocation.title = "Search other schools";
            }
        });
    }
}

// --------- Utility functions --------- //
// Returns search url for specific school
function getSacStateProfURL(profNameWithSpace) {
    return "http://www.ratemyprofessors.com/search.jsp?queryBy=teacherName&schoolName=" + rmpSchoolUrl +
        "&queryoption=HEADER&query=" + encodeURI(profNameWithSpace) + "&facetSearch=true";
}

// Returns search url for all schools
function getAllSchoolsURL(profNameWithSpace) {
    return "http://www.ratemyprofessors.com/search.jsp?queryBy=teacherName&query=" + encodeURI(profNameWithSpace);
}

function isStringArrayInString(strArray, str) {
    for (var i = 0; i < strArray.length; i++) {
        if (str.indexOf(strArray[i]) !== -1) {
            return true;
        }
    }
    return false;
}

function log(msg) {
    console.log(msg);
}
