/*<Event Page to direct events called from content scripts>
 Copyright (C) <2015>  <Kyle Szombathy, William Hexberg>

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

// Displays icon in address bar when script is active
function showPageAction( tabId, changeInfo, tab ) {
    if(tab.url == "https://cmsweb.csus.edu/psp/HSACPRD/EMPLOYEE/HRMS/c/SA_LEARNER_SERVICES.SSS_STUDENT_CENTER.GBL?PORTALPARAM_PTCNAV=HC_SSS_STUDENT_CENTER&EOPP.SCNode=HRMS&EOPP.SCPortal=EMPLOYEE&EOPP.SCName=CO_EMPLOYEE_SELF_SERVICE&EOPP.SCLabel=Self_Service&EOPP.SCPTfname=CO_EMPLOYEE_SELF_SERVICE&FolderPath=PORTAL_ROOT_OBJECT.CO_EMPLOYEE_SELF_SERVICE.HC_SSS_STUDENT_CENTER&IsFolder=false"){
        chrome.pageAction.show(tabId);
    }
}

chrome.tabs.onUpdated.addListener(showPageAction);

/*
// OmniBox search implementation
// Needs to be reworked for eventPage instead of background
function resetDefaultSuggestion() {
  chrome.omnibox.setDefaultSuggestion({
  description: 'Search RateMyProfessor for %s'
  });
}
resetDefaultSuggestion();

function navigate(url) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  chrome.tabs.update(tabs[0].id, {url: url});
  });
}

chrome.omnibox.onInputEntered.addListener(function(searchName) {
  navigate(returnUrl(searchName));
});

// Context menu implementation
chrome.contextMenus.create({
    "title": "Search RateMyProfessor for %s",
    "contexts": ["selection"],
    "onclick": function(e) {
        var profNameWithSpace = e.selectionText;
        searchNewTab(profNameWithSpace);
    }
});

function searchNewTab(profNameWithSpace) {
    var url = returnUrl(profNameWithSpace); // creates url for RMP with selected text
    chrome.tabs.create(
        {"url": url});
}

// Misc functions
function returnUrl(profNameWithSpace) {
    return "http://www.ratemyprofessors.com/search.jsp?queryBy=teacherName&schoolName=" + schoolName +
           "&queryoption=HEADER&query=" + encodeURI(profNameWithSpace) + "&facetSearch=true";
}
*/

// Retrieves copy of RMP HTML and parses with regex (I know I know I should have used an xml parser)
chrome.runtime.onMessage.addListener(function(request, sender, callback) {

    var xhr = new XMLHttpRequest();

    // Opens URL
    xhr.open('GET', request.url, true);

    // If URL retrieval is error
    xhr.onerror = function() {
        callback();
    };

    xhr.onreadystatechange = function() {
        // If xhr is ready
        if (xhr.readyState == 4) {

            var htmlString = xhr.responseText; /* Sets entire html of page to string 
            This sanitizes the html against potential attackers*/

            // If url is teacher search page
            if (/http:..www.ratemyprofessors.com.search.jsp.queryBy=teacherName&schoolName=/g.test(request.url)) {
                
                var regex = /ShowRatings.jsp\?tid=\d*/g; // Regex for finding place in page where prof link is located

                if (regex.test(htmlString)) {
                    var postFixUrl = regex.exec(htmlString);

                    if (postFixUrl !== null) {
                        var profURL = 'http://www.ratemyprofessors.com/' + postFixUrl;
                        console.log(profURL);
                        callback(profURL);
                    }
                    else callback();
                }
                else callback();
            }

            // If url is profURL
            else if (/http:..www.ratemyprofessors.com.ShowRatings.jsp.tid=\d*/.test(request.url)) {
                var overallQualityRegex = /<div class="grade">[1-5]\.\d/;
                var ratingsRegex = /<div class="rating">[1-5]\.\d/g;
                var ratingRegex = /[1-5]\.\d/; // Regex to sort out all ratings in a d.d format
                var averageGradeRegex  = /<div class="grade">[A-F](\+|-|)/; // Regex to find grade in page
                var hotnessRegex = /cold-chili\.png/;
                var hotness;
                var ratingArray = [];

                gradeFinder(averageGradeRegex, 0, 19);   // Grade letter
                gradeFinder(overallQualityRegex, 0, 19); // Overall Quality
                ratingFinder(ratingsRegex, 0, 20);        // Helpfullness, Clarity, Easiness

                function gradeFinder(regex, arrayNumber, sliceNumber) {
                    if (regex.test(htmlString)) {
                        var data = "" + regex.exec(htmlString)[arrayNumber]; // exec is an array, transfers exec[0] to string

                        data = data.slice(sliceNumber);
                        console.log(data);
                        ratingArray.push(data);
                    }   else {
                        ratingArray.push("N/A")
                    }
                }

                function ratingFinder(regex, arrayNumber, sliceNumber) {
                    for(i = 0; i < 3; i++) {
                        var data = "" + regex.exec(htmlString); // exec is an array, transfers exec[0] to string

                        data = data.slice(sliceNumber);
                        console.log(data);
                        ratingArray.push(data);
                    }
                }


                // If no grades found


                /* Works, but looks cluttered on main
                // Finds hotness
                if (hotnessRegex.test(htmlString)) {
                    hotness = "no";
                    ratingArray.push(hotness);
                }

                else {
                    hotness = "yes";
                    ratingArray.push(hotness);
                }
                */

                console.log(ratingArray);
                callback(ratingArray)
            }

            // If wrong URL is sent
            else {
                callback();
            }
        }
    };

    xhr.send();

    return true; // prevents the callback from being called too early on return
});

/*
chrome.storage.onChanged.addListener(function(changes, namespace) {
    for (key in changes) {
      var storageChange = changes[key];
      console.log('Storage key "%s" in namespace "%s" changed. ' +
                  'Old value was "%s", new value is "%s".',
                  key,
                  namespace,
                  storageChange.oldValue,
                  storageChange.newValue);
    }
});
*/