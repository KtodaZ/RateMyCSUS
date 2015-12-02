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
 
var schoolName = 'California+State+University%2C+Sacramento';
var schoolNameString = "Sacramento State";
var exclusions = ["TBA", "Online", "Staff", "Fee"];
var professorClassName = 'PSLONGEDITBOX';
var iframeObject = $("#ptifrmtgtframe");
var timers = [];

// --------- Initializing functions --------- //

// Starting point of program
function sacState() {
    $(document).ready(function()
    {
        // Clears all timers so they don't stack and create lag
        for (var i = 0; i < timers.length; i++)
            clearTimeout(timers[i]);

        // Removes ghost qtips from page if any
        $(".qtip").remove();

        iframeChecker();
    });

}

// Checks if iframe is on correct page to inject custom html
function iframeChecker() {
    console.log("Scanning page for professors");

    var iframeBody = $(iframeObject).contents().find("body");
    var iframeBodyHtml = $(iframeBody).html();

    // Creates temporary html element to experiment with
    var tmp = document.createElement('div');
    tmp.innerHTML = iframeBodyHtml;

    // Detects if page contains names, if it does, returns new HTML
    var newHtml = main(professorClassName, tmp, false);

    if (newHtml) {
        console.log("Professors found, script executed");

        // Sets new HTML to iframe HTML
        $(iframeObject).contents().find("body").html(newHtml);

        // Timer to check if page is changed
        timers.push(setInterval(function () {
            iframeBody = $(iframeObject).contents().find("body");

            //console.log("Scanning for changes"); // Debugging
            
            // Looks for "link" class in html document to see if our html is injected
            if ($(".link",iframeBody).length == 0) {
                console.log("Page changed. Starting search.")
                sacState();
            }
        }, 2000));
    } else {

        // Waits x seconds to check page again
        timers.push(setTimeout(function () {
            sacState();
        }, 2500));
    }
}

// --------- Main functionality --------- //

// Function to parse webpage for teacher names and attach tooltips
function main(className, pageHtml, checkForTeachers) {
    var numberOfProfs = 0;

    // Sorts out element where teacher names are located
    var cellArray     = pageHtml.getElementsByClassName(className);

    for(var i =0; i < cellArray.length; i++) {
        // Gets text from object array and splits into temp strings
        var profName;
        var profTempArray = [];
        var profNameWithFormatting = $(cellArray[i]).html();

        // Sorts out potential teacher names by space and puts into array
        profTempArray = $(cellArray[i]).text().trim().split(/[ ]+/);
        //console.log(profTempArray);

        try {
            // To search for specific regex in sac states website
            var regex0 = new RegExp(profTempArray[0]);
            var regex2 = new RegExp(profTempArray[2]);
        } catch(e) { // For Regex errors
        }

        // Global search function
        if (profTempArray.length === 2
            && checkIfTeacherNameInArray(profTempArray)
            && !/\./.test(profTempArray[0]) && !/\./.test(profTempArray[1])
            && profTempArray.indexOf("Online") === -1
            && !isStringArrayInStringArray(exclusions, profTempArray)) {

            // Replaces "Staff" String in Array with blank so that it is not queried
            var staffLocation = searchStringInStringArray ("Staff", profTempArray);
            if (staffLocation > -1) {
                profTempArray[staffLocation] = profTempArray[staffLocation].replace(/Staff/g,'');
            }

            profName = profTempArray[0] + " " + profTempArray[1];
            mainRunScript();
        }

        // Specific search function for double line prof names
        if (profTempArray.length == 3
            && regex0.test(profTempArray[1]) && regex2.test(profTempArray[1])
            && checkIfTeacherNameInArray(profTempArray)
            && !/\./.test(profTempArray[0]) && !/\./.test(profTempArray[1]) && !/\./.test(profTempArray[2])
            && profTempArray.indexOf("Online") === -1 && searchStringInStringArray("Staff", profTempArray) === -1) {

            //console.log(profTempArray); // For Debugging

            profName = profTempArray[0] + " " + profTempArray[2];
            mainRunScript();
        }

        function mainRunScript() {
            // Returns true if at least 1 teacher is found
            if (checkForTeachers)
                return true;

           
            //console.log(profName);  // For debugging

            // Creates placeholder hyperlinks
            var url = '<a class="link" href="'+ returnNormalSearchUrl(profName) + '" target="_blank" title="RMP Search page">'+ profNameWithFormatting + '</a>';
            $(cellArray[i]).text('');
            cellArray[i].innerHTML = url;
            numberOfProfs++;

            // Call for tooltips and dynamic content load
            tooltip(cellArray[i], pageHtml);
            hover(cellArray[i], profName, profNameWithFormatting);
        }

        // Utility function
        function checkIfTeacherNameInArray(strArray) {
            for (var counter = 0, j=0; j<strArray.length; j++) {
                if (/[A-Z]/.test(profTempArray[j]) && !/\./.test(profTempArray[j])) counter++;
            }
            return (counter == strArray.length);
        }
    }

    // Returns false if no profs are found
    if (numberOfProfs > 0)
        return pageHtml;
    else
        return false;
}

// Creates default tooltip & tooltip settings
function tooltip(cell, pageHtml) {
    $(cell).qtip({
        id: 'profTip',
        prerender: true,
        content: {
            text: "<b>Click</b> the links to view their Rate My Professor page",
            title: "<b>Hover</b> over any professor name to view their ratings",
            button: 'close'
        },
        position: {
            target: [700, 115],
            viewport: iframeObject
        },
        style: {
            classes: 'qtip-bootstrap',
            width: 160,
            //heigth: 160,
            tip: {
                corner: false
            }
        },
        show: {
            solo: true,
            ready: true,
            effect: function(offset) {
                $(this).slideDown(100);
            }
        },
        hide: {
            event: 'unfocus',
            leave: false,
            fixed: true,
            effect: function(offset) {
                $(this).slideDown(100);
            }
        }
    });
}

// Dynamically calls setProfessorURL on mouse over "cell" element
function hover(cell, profNameWithSpace, profNameWithFormatting) {

    var haveProfUrl = false;

    $(cell).mouseenter(function() {

        // Checks hyperlink so setProfessorURL only loads once
        if (!haveProfUrl) {
            $(cell).qtip('option', 'content.title', '');
            $(cell).qtip('option', 'content.text', '. . . loading . . .');
            setProfessorURL(cell, profNameWithSpace, profNameWithFormatting);
            haveProfUrl = true;
        }
    });
}

// Uses chrome function to search for proffessor, gets URL and Ratings
function setProfessorURL(cell, profNameWithSpace, profNameWithFormatting) {

    var searchURL = returnSchoolSearchUrl(profNameWithSpace);

    // Makes call to event page and returns with prof URL
    chrome.runtime.sendMessage({
        url: searchURL
    }, function (response) {

        var profURL = response;
        //console.log(profURL);

        // If a professor is found
        if (profURL != null) {

            // Makes second call to event page to get specific ratings in an array
            chrome.runtime.sendMessage({
                url: profURL
            }, function (response) {
                var ratingArray = response;
                //console.log(ratingArray);

                // Sets tooltips implementing html for formatting
                $(cell).qtip('option', 'content.text',
                    '<div id=\"contentBox\" style=\"margin:0px auto; width:100%\">' +
                    '<div id=\"column1\" style=\"float:left; margin:0; width:80%;\">' +
                    "Overall Quality:<br>Average Grade:<br>Helpfulness:<br>Clarity:<br>Easiness:" +
                    '</div>' +
                    '<div id=\"column2\" style=\"float:left; margin:0;width:20%;\">' +
                     ratingArray[1] + "<br>" + ratingArray[0]+ "<br>" + ratingArray[2] + "<br>" + ratingArray[3] + "<br>" + ratingArray[4] +
                    '</div>' +
                    '</div>');

                $(cell).qtip('option', 'content.title', "<b>" + profNameWithSpace + "</b>");
            });
        }
        // If no prof is found
        else {
            profURL = returnNormalSearchUrl(profNameWithSpace);
            $(cell).qtip('option', 'content.title',"<b>N/A</b>");
            $(cell).qtip('option', 'content.text',"No professors found for " + schoolNameString + ' ' 
                + '<a class="link" href="'+ profURL + '" target="_blank" title="">'+ 'click here to search all schools' + '</a>');
        }

        // Applies new hyperlink to page
        cell.innerHTML = '<a class="link" href="'+ profURL + '" target="_blank" title="">'+ profNameWithFormatting + '</a>';

    });
}

// --------- Utility functions --------- //

// Searches for inputed string in a string array
function searchStringInStringArray (str, strArray) {
    for (var j=0; j<strArray.length; j++) {
        if (strArray[j].match(str)) return j;
    }
    return -1;
}

// Searches String Array B for elements of String Array A
function isStringArrayInStringArray (strArrayA, strArrayB) {
    for (var i=0; i<strArrayA.length; i++) {
        for (var j=0; j<strArrayB.length; j++) {
            if (strArrayB[j].indexOf(strArrayA[i]) !== -1) {
                //console.log(strArrayA[i] + " found in " + strArrayB); //Deubugging
                return true; 
            } 
        }
    }
    return false;
}

// Returns search url for specific school
function returnSchoolSearchUrl(profNameWithSpace) {
    return "http://www.ratemyprofessors.com/search.jsp?queryBy=teacherName&schoolName=" + schoolName +
        "&queryoption=HEADER&query=" + encodeURI(profNameWithSpace) + "&facetSearch=true";
}

// Returns search url for all schools
function returnNormalSearchUrl(profNameWithSpace) {
    return "http://www.ratemyprofessors.com/search.jsp?queryBy=teacherName&query=" + encodeURI(profNameWithSpace);
}

// --------- Entry Point --------- //

sacState();
