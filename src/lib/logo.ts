/**
 * Generate an ASCII art logo with optional comment markers.
 * @param {string} beginningComment - Comment marker to add at the start of each line
 * @param {string} [endingComment=''] - Optional comment marker to add at the end of each line
 * @returns {string} The formatted ASCII art logo as a string
 */
function logo(beginningComment: string, endingComment?: string): string {
  endingComment = endingComment ? endingComment : '';
  return `${beginningComment}       @@@@@@@                 @@@@@                 ${endingComment}
${beginningComment}     @@@@@@@@@               @@@@@@@                 ${endingComment}
${beginningComment}    @@@@@@@@@@              @@@@@@@@                 ${endingComment}
${beginningComment}  @@@@@@@@@@@@             @@@@@@@@@                 ${endingComment}
${beginningComment} @@@@@@@@@@@@@            @@@@@@@@@@@                ${endingComment}
${beginningComment} @@@@@@@@@@@@@            @@@@@@@@@@@@               ${endingComment}
${beginningComment} @@@@@@@@@@@@@            @@@@@@@@@@@@@              ${endingComment}
${beginningComment} @@@@@@@@@@@@@            @@@@@@@@@@@@@@@            ${endingComment}
${beginningComment} @@@@@@@@@@@@@            @@@@@@@@@@@@@@@@@@@@@@@@@@ ${endingComment}
${beginningComment} @@@@@@@@@@@@@            @@@@@@@@@@@@@@@@@@@@@@@@@@ ${endingComment}
${beginningComment} @@@@@@@@@@@@@            @@@@@@@@@@@@@@@@@@@@@@@@@@ ${endingComment}
${beginningComment} @@@@@@@@@@@@@            @@@@@@@@@@@@@@@@@@@@@@@@@@ ${endingComment}
${beginningComment} @@@@@@@@@@@@@         @@@@@@@@@@@@@@@@@@@@@@@@@@@@@ ${endingComment}
${beginningComment} @@@@@@@@@@@@@@@    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ ${endingComment}
${beginningComment} @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@    @@@@@@@@@@@@@@@ ${endingComment}
${beginningComment} @@@@@@@@@@@@@@@@@@@@@@@@@@@@@         @@@@@@@@@@@@@ ${endingComment}
${beginningComment} @@@@@@@@@@@@@@@@@@@@@@@@@@            @@@@@@@@@@@@@ ${endingComment}
${beginningComment} @@@@@@@@@@@@@@@@@@@@@@@@@@            @@@@@@@@@@@@@ ${endingComment}
${beginningComment} @@@@@@@@@@@@@@@@@@@@@@@@@@            @@@@@@@@@@@@@ ${endingComment}
${beginningComment} @@@@@@@@@@@@@@@@@@@@@@@@@@            @@@@@@@@@@@@@ ${endingComment}
${beginningComment}            @@@@@@@@@@@@@@@            @@@@@@@@@@@@@ ${endingComment}
${beginningComment}              @@@@@@@@@@@@@            @@@@@@@@@@@@@ ${endingComment}
${beginningComment}               @@@@@@@@@@@@            @@@@@@@@@@@@@ ${endingComment}
${beginningComment}                @@@@@@@@@@@            @@@@@@@@@@@@@ ${endingComment}
${beginningComment}                 @@@@@@@@@             @@@@@@@@@@@@  ${endingComment}
${beginningComment}                 @@@@@@@@              @@@@@@@@@@    ${endingComment}
${beginningComment}                 @@@@@@@               @@@@@@@@@     ${endingComment}
${beginningComment}                 @@@@                  @@@@@@        ${endingComment}
`;
}

export default logo;
