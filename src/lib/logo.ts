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
