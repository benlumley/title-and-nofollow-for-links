var wpLink;

( function( $, wpLinkL10n, wp ) {
	var editor, searchTimer, River, Query, correctedURL, linkNode,
		emailRegexp = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}$/i,
		urlRegexp = /^(https?|ftp):\/\/[A-Z0-9.-]+\.[A-Z]{2,63}[^ "]*$/i,
		inputs = {},
		rivers = {},
		isTouch = ( 'ontouchend' in document );

	function getLink() {
		return linkNode || editor.dom.getParent( editor.selection.getNode(), 'a[href]' );
	}

	wpLink = {
		timeToTriggerRiver: 150,
		minRiverAJAXDuration: 200,
		riverBottomThreshold: 5,
		keySensitivity: 100,
		lastSearch: '',
		textarea: '',
		modalOpen: false,

		init: function() {

            //change by "Title and Nofollow for Links" begin
            $("#wp-link .link-target").append('<br><label style="padding-left: 4px;"><span>&nbsp;</span><input type="checkbox" id="tanfl-add-nofollow">' + wpLinkL10n.noFollow + "</label>");
            $("#wp-link .link-target").append('<br><label style="padding-left: 4px;"><span>&nbsp;</span><input type="checkbox" id="tanfl-add-sponsored">' + ' Add <code>rel="sponsored"</code> to link' + '</label>');
            $("#wp-link .link-target").append('<br><label style="padding-left: 4px;"><span>&nbsp;</span><input type="checkbox" id="tanfl-add-retailer">' + ' Don\'t process as an affiliate link' + '</label><br>');
            $(".wp-link-text-field").before('<div class="link-title-field"><label><span style="padding-left: 4px;">' + wpLinkL10n.labelTitle + '</span><input id="wp-link-title" type="text" name="linktitle" /></label></div>');
            $('<style type="text/css"> .has-text-field #wp-link .query-results { top: 256px !important; } #wp-link-wrap.search-panel-visible {height: 549px !important;}</style>').appendTo("head");
            //change by "Title and Nofollow for Links" end

			inputs.wrap = $('#wp-link-wrap');
			inputs.dialog = $( '#wp-link' );
			inputs.backdrop = $( '#wp-link-backdrop' );
			inputs.submit = $( '#wp-link-submit' );
			inputs.close = $( '#wp-link-close' );

            //change by "Title and Nofollow for Links" begin
            inputs.tanfl = $( '#tanfl-add-nofollow' );
            inputs.tanfl_retailer = $( '#tanfl-add-retailer' );
            inputs.tanfl_sponsored = $( '#tanfl-add-sponsored' );
 			inputs.title = $( '#wp-link-title' );
            //change by "Title and Nofollow for Links" end

			// Input
			inputs.text = $( '#wp-link-text' );
			inputs.url = $( '#wp-link-url' );
			inputs.nonce = $( '#_ajax_linking_nonce' );
			inputs.openInNewTab = $( '#wp-link-target' );
			inputs.search = $( '#wp-link-search' );

			// Build Rivers
			rivers.search = new River( $( '#search-results' ) );
			rivers.recent = new River( $( '#most-recent-results' ) );
			rivers.elements = inputs.dialog.find( '.query-results' );

			// Get search notice text
			inputs.queryNotice = $( '#query-notice-message' );
			inputs.queryNoticeTextDefault = inputs.queryNotice.find( '.query-notice-default' );
			inputs.queryNoticeTextHint = inputs.queryNotice.find( '.query-notice-hint' );

			// Bind event handlers
			inputs.dialog.on( 'keydown', function(){
				console.log( 'keydown' );
			});
			inputs.dialog.on( 'keyup', function(){
				wpLink.keyup
			});
			inputs.submit.on( 'click', function( event ) {
				event.preventDefault();
				wpLink.update();
			});

			inputs.close.add( inputs.backdrop ).add( '#wp-link-cancel button' ).on( 'click', function( event ) {
				event.preventDefault();
				wpLink.close();
			});

			rivers.elements.on( 'river-select', wpLink.updateFields );

			// Display 'hint' message when search field or 'query-results' box are focused
			inputs.search.on( 'focus.wplink', function() {
				inputs.queryNoticeTextDefault.hide();
				inputs.queryNoticeTextHint.removeClass( 'screen-reader-text' ).show();
			} ).on( 'blur.wplink', function() {
				inputs.queryNoticeTextDefault.show();
				inputs.queryNoticeTextHint.addClass( 'screen-reader-text' ).hide();
			} );

			inputs.search.on( 'keyup input', function() {
				window.clearTimeout( searchTimer );
				searchTimer = window.setTimeout( function() {
					wpLink.searchInternalLinks();
				}, 500 );
			});

			inputs.url.on( 'paste', function() {
				setTimeout( wpLink.correctURL, 0 );
			} );

			inputs.url.on( 'blur', wpLink.correctURL );
		},

		// If URL wasn't corrected last time and doesn't start with http:, https:, ? # or /, prepend http://
		correctURL: function () {
			var url = $.trim( inputs.url.val() );

			if ( url && correctedURL !== url && ! /^(?:[a-z]+:|#|\?|\.|\/)/.test( url ) ) {
				inputs.url.val( 'http://' + url );
				correctedURL = url;
			}
		},

		open: function( editorId, url, text, node ) {
			var ed,
				$body = $( document.body );

			$body.addClass( 'modal-open' );
			wpLink.modalOpen = true;
			linkNode = node;

			wpLink.range = null;

			if ( editorId ) {
				window.wpActiveEditor = editorId;
			}

			if ( ! window.wpActiveEditor ) {
				return;
			}

			this.textarea = $( '#' + window.wpActiveEditor ).get( 0 );

			if ( typeof window.tinymce !== 'undefined' ) {
				// Make sure the link wrapper is the last element in the body,
				// or the inline editor toolbar may show above the backdrop.
				$body.append( inputs.backdrop, inputs.wrap );

				ed = window.tinymce.get( window.wpActiveEditor );

				if ( ed && ! ed.isHidden() ) {
					editor = ed;
				} else {
					editor = null;
				}
			}

			if ( ! wpLink.isMCE() && document.selection ) {
				this.textarea.focus();
				this.range = document.selection.createRange();
			}

			inputs.wrap.show();
			inputs.backdrop.show();

			wpLink.refresh( url, text );

			$( document ).trigger( 'wplink-open', inputs.wrap );
		},

		isMCE: function() {
			return editor && ! editor.isHidden();
		},

		refresh: function( url, text ) {
			var linkText = '';

			// Refresh rivers (clear links, check visibility)
			rivers.search.refresh();
			rivers.recent.refresh();

			if ( wpLink.isMCE() ) {
				wpLink.mceRefresh( url, text );
			} else {
				// For the Text editor the "Link text" field is always shown
				if ( ! inputs.wrap.hasClass( 'has-text-field' ) ) {
					inputs.wrap.addClass( 'has-text-field' );
				}

				if ( document.selection ) {
					// Old IE
					linkText = document.selection.createRange().text || text || '';
				} else if ( typeof this.textarea.selectionStart !== 'undefined' &&
					( this.textarea.selectionStart !== this.textarea.selectionEnd ) ) {
					// W3C
					text = this.textarea.value.substring( this.textarea.selectionStart, this.textarea.selectionEnd ) || text || '';
				}

				inputs.text.val( text );
				wpLink.setDefaultValues();
			}

			if ( isTouch ) {
				// Close the onscreen keyboard
				inputs.url.focus().blur();
			} else {
				// Focus the URL field and highlight its contents.
				// If this is moved above the selection changes,
				// IE will show a flashing cursor over the dialog.
				window.setTimeout( function() {
					inputs.url[0].select();
					inputs.url.focus();
				} );
            }

			// Load the most recent results if this is the first time opening the panel.
			if ( ! rivers.recent.ul.children().length ) {
				rivers.recent.ajax();
			}

            correctedURL = inputs.url.val().replace( /^http:\/\//, '' );

            //change by "Title and Nofollow for Links" begin
            jQuery('.has-text-field #wp-link .query-results').css( 'margin-top', 25 );
            //change by "Title and Nofollow for Links" end

		},

		hasSelectedText: function( linkNode ) {
			var node, nodes, i, html = editor.selection.getContent();

			// Partial html and not a fully selected anchor element
			if ( /</.test( html ) && ( ! /^<a [^>]+>[^<]+<\/a>$/.test( html ) || html.indexOf('href=') === -1 ) ) {
				return false;
			}

			if ( linkNode ) {
				nodes = linkNode.childNodes;

				if ( nodes.length === 0 ) {
					return false;
				}

				for ( i = nodes.length - 1; i >= 0; i-- ) {
					node = nodes[i];

					if ( node.nodeType != 3 && ! window.tinymce.dom.BookmarkManager.isBookmarkNode( node ) ) {
						return false;
					}
				}
			}

			return true;
		},

		mceRefresh: function( searchStr, text ) {
			var linkText, href,
				linkNode = getLink(),
				onlyText = this.hasSelectedText( linkNode );

			if ( linkNode ) {
				linkText = linkNode.textContent || linkNode.innerText;
				href = editor.dom.getAttrib( linkNode, 'href' );

				if ( ! $.trim( linkText ) ) {
					linkText = text || '';
				}

				if ( searchStr && ( urlRegexp.test( searchStr ) || emailRegexp.test( searchStr ) ) ) {
					href = searchStr;
				}

				if ( href !== '_wp_link_placeholder' ) {
					inputs.url.val( href );
					inputs.openInNewTab.prop( 'checked', '_blank' === editor.dom.getAttrib( linkNode, 'target' ) );
					inputs.submit.val( wpLinkL10n.update );
				} else {
					this.setDefaultValues( linkText );
				}

				if ( searchStr && searchStr !== href ) {
					// The user has typed something in the inline dialog. Trigger a search with it.
					inputs.search.val( searchStr );
				} else {
					inputs.search.val( '' );
				}

                //change by "Title and Nofollow for Links" begin
				if (editor.dom.getAttrib(linkNode, 'rel').indexOf("nofollow") >= 0){
					inputs.tanfl.prop('checked', true);
                } else {
					inputs.tanfl.prop('checked', false);
                }

                inputs.tanfl_sponsored.prop('checked', false);
                inputs.tanfl_retailer.prop('checked', false);

                if (editor.dom.getAttrib(linkNode, 'rel').indexOf("sponsored") >= 0){
					inputs.tanfl_sponsored.prop('checked', true);
                }

                if (editor.dom.getAttrib(linkNode, 'data-exc-retailer') ) {
                    inputs.tanfl_retailer.prop('checked', true);
                }

                inputs.title.val( editor.dom.getAttrib( linkNode, 'title' ) );
                //change by "Title and Nofollow for Links" begin

				// Always reset the search
				window.setTimeout( function() {
					wpLink.searchInternalLinks();
				} );
			} else {
				linkText = editor.selection.getContent({ format: 'text' }) || text || '';
				this.setDefaultValues( linkText );
			}

			if ( onlyText ) {
				inputs.text.val( linkText );
				inputs.wrap.addClass( 'has-text-field' );
			} else {
				inputs.text.val( '' );
				inputs.wrap.removeClass( 'has-text-field' );
			}
		},

		close: function( reset ) {
			$( document.body ).removeClass( 'modal-open' );
			wpLink.modalOpen = false;

			if ( reset !== 'noReset' ) {
				if ( ! wpLink.isMCE() ) {
					wpLink.textarea.focus();

					if ( wpLink.range ) {
						wpLink.range.moveToBookmark( wpLink.range.getBookmark() );
						wpLink.range.select();
					}
				} else {
					if ( editor.plugins.wplink ) {
						editor.plugins.wplink.close();
					}

					editor.focus();
				}
			}

			inputs.backdrop.hide();
			inputs.wrap.hide();

			correctedURL = false;

			$( document ).trigger( 'wplink-close', inputs.wrap );
		},

		getAttrs: function() {
			wpLink.correctURL();

            //change by "Title and Nofollow for Links" begin
            var tanfl_value = [];
            if ( inputs.tanfl.prop('checked') ) {
                tanfl_value.push('nofollow');
			}
            if ( inputs.tanfl_sponsored.prop('checked') ) {
                tanfl_value.push('sponsored');
            }

            tandfl_value = tanfl_value.join(' ');

            extra = {};
            if (inputs.tanfl_retailer.prop('checked')) {
                extra['data-exc-retailer'] = '1';
            } else {
                extra['data-exc-retailer'] = null;
            }

            //change by "Title and Nofollow for Links" end

			return {
				href: $.trim( inputs.url.val() ),
				target: inputs.openInNewTab.prop( 'checked' ) ? '_blank' : null, // , - by "Title and Nofollow for Links" begin
                //change by "Title and Nofollow for Links" begin
				rel: tanfl_value,
        		title: $.trim( inputs.title.val() ),
                //change by "Title and Nofollow for Links" end
                ...extra
			};
		},

		buildHtml: function(attrs) {
			var html = '<a href="' + attrs.href + '"';

            //change by "Title and Nofollow for Links" begin
            if ( attrs.title ) {
				title = attrs.title.replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' );
				html += ' title="' + title + '"';
			}

			if ( attrs.target ) {
                if ( attrs.rel ) {
                    html += ' rel="noopener nofollow" target="' + attrs.target + '"';
                }
                else {
                    html += ' rel="noopener" target="' + attrs.target + '"';
                }
			} else {
                if ( attrs.rel ) {
                    html += ' rel="' + attrs.rel + '"';
                }
			}
            //change by "Title and Nofollow for Links" end


			return html + '>';
		},

		update: function() {
			if ( wpLink.isMCE() ) {
				wpLink.mceUpdate();
			} else {
				wpLink.htmlUpdate();
			}
		},

		htmlUpdate: function() {
			var attrs, text, html, begin, end, cursor, selection,
				textarea = wpLink.textarea;

			if ( ! textarea ) {
				return;
			}

			attrs = wpLink.getAttrs();
			text = inputs.text.val();

			var parser = document.createElement( 'a' );
			parser.href = attrs.href;

			if ( 'javascript:' === parser.protocol || 'data:' === parser.protocol ) { // jshint ignore:line
				attrs.href = '';
			}

			// If there's no href, return.
			if ( ! attrs.href ) {
				return;
			}



			html = wpLink.buildHtml(attrs);


			// Insert HTML
			if ( document.selection && wpLink.range ) {
				// IE
				// Note: If no text is selected, IE will not place the cursor
				//       inside the closing tag.
				textarea.focus();
				wpLink.range.text = html + ( text || wpLink.range.text ) + '</a>';
				wpLink.range.moveToBookmark( wpLink.range.getBookmark() );
				wpLink.range.select();

				wpLink.range = null;
			} else if ( typeof textarea.selectionStart !== 'undefined' ) {
				// W3C
				begin = textarea.selectionStart;
				end = textarea.selectionEnd;
				selection = text || textarea.value.substring( begin, end );
				html = html + selection + '</a>';
				cursor = begin + html.length;

				// If no text is selected, place the cursor inside the closing tag.
				if ( begin === end && ! selection ) {
					cursor -= 4;
				}

				textarea.value = (
					textarea.value.substring( 0, begin ) +
					html +
					textarea.value.substring( end, textarea.value.length )
				);

				// Update cursor position
				textarea.selectionStart = textarea.selectionEnd = cursor;
			}

			wpLink.close();
			textarea.focus();
			$( textarea ).trigger( 'change' );

			// Audible confirmation message when a link has been inserted in the Editor.
			wp.a11y.speak( wpLinkL10n.linkInserted );
		},

		mceUpdate: function() {
			var attrs = wpLink.getAttrs(),
				$link, text, hasText, $mceCaret;

			var parser = document.createElement( 'a' );
			parser.href = attrs.href;

			if ( 'javascript:' === parser.protocol || 'data:' === parser.protocol ) { // jshint ignore:line
				attrs.href = '';
			}

			if ( ! attrs.href ) {
				editor.execCommand( 'unlink' );
				wpLink.close();
				return;
			}

			$link = editor.$( getLink() );

			editor.undoManager.transact( function() {
				if ( ! $link.length ) {
					editor.execCommand( 'mceInsertLink', false, { href: '_wp_link_placeholder', 'data-wp-temp-link': 1 } );
					$link = editor.$( 'a[data-wp-temp-link="1"]' ).removeAttr( 'data-wp-temp-link' );
					hasText = $.trim( $link.text() );
				}

				if ( ! $link.length ) {
					editor.execCommand( 'unlink' );
				} else {
					if ( inputs.wrap.hasClass( 'has-text-field' ) ) {
						text = inputs.text.val();

						if ( text ) {
							$link.text( text );
						} else if ( ! hasText ) {
							$link.text( attrs.href );
						}
					}

					attrs['data-wplink-edit'] = null;
					attrs['data-mce-href'] = null; // attrs.href

                    //change by "Title and Nofollow for Links" begin
                    if ( !attrs.title ) {
                         attrs['title'] = null;
                    }
                    //change by "Title and Nofollow for Links" end


					$link.attr( attrs );
				}
			} );

			wpLink.close( 'noReset' );
			editor.focus();

			if ( $link.length ) {
				$mceCaret = $link.parent( '#_mce_caret' );

				if ( $mceCaret.length ) {
					$mceCaret.before( $link.removeAttr( 'data-mce-bogus' ) );
				}

				editor.selection.select( $link[0] );
				editor.selection.collapse();

				if ( editor.plugins.wplink ) {
					editor.plugins.wplink.checkLink( $link[0] );
				}
			}

			editor.nodeChanged();

			// Audible confirmation message when a link has been inserted in the Editor.
			wp.a11y.speak( wpLinkL10n.linkInserted );
		},

		updateFields: function( e, li ) {
			inputs.url.val( li.children( '.item-permalink' ).val() );
            //change by "Title and Nofollow for Links" begin
			inputs.title.val( li.hasClass( 'no-title' ) ? '' : li.children( '.item-title' ).text() );
            //change by "Title and Nofollow for Links" end
		},

		getUrlFromSelection: function( selection ) {
			if ( ! selection ) {
				if ( this.isMCE() ) {
					selection = editor.selection.getContent({ format: 'text' });
				} else if ( document.selection && wpLink.range ) {
					selection = wpLink.range.text;
				} else if ( typeof this.textarea.selectionStart !== 'undefined' ) {
					selection = this.textarea.value.substring( this.textarea.selectionStart, this.textarea.selectionEnd );
				}
			}

			selection = $.trim( selection );

			if ( selection && emailRegexp.test( selection ) ) {
				// Selection is email address
				return 'mailto:' + selection;
			} else if ( selection && urlRegexp.test( selection ) ) {
				// Selection is URL
				return selection.replace( /&amp;|&#0?38;/gi, '&' );
			}

			return '';
		},

		setDefaultValues: function( selection ) {
			inputs.url.val( this.getUrlFromSelection( selection ) );

            //change by "Title and Nofollow for Links" begin
        	inputs.title.val( '' );
            //change by "Title and Nofollow for Links" end

			// Empty the search field and swap the "rivers".
			inputs.search.val('');
			wpLink.searchInternalLinks();

			// Update save prompt.
			inputs.submit.val( wpLinkL10n.save );
		},

		searchInternalLinks: function() {
			var waiting,
				search = inputs.search.val() || '';

			if ( search.length > 2 ) {
				rivers.recent.hide();
				rivers.search.show();

				// Don't search if the keypress didn't change the title.
				if ( wpLink.lastSearch == search )
					return;

				wpLink.lastSearch = search;
				waiting = inputs.search.parent().find( '.spinner' ).addClass( 'is-active' );

				rivers.search.change( search );
				rivers.search.ajax( function() {
					waiting.removeClass( 'is-active' );
				});
			} else {
				rivers.search.hide();
				rivers.recent.show();
			}
		},

		next: function() {
			rivers.search.next();
			rivers.recent.next();
		},

		prev: function() {
			rivers.search.prev();
			rivers.recent.prev();
		},

		keydown: function( event ) {
			var fn, id;

			// Escape key.
			if ( 27 === event.keyCode ) {
				wpLink.close();
				event.stopImmediatePropagation();
			// Tab key.
			} else if ( 9 === event.keyCode ) {
				id = event.target.id;

				// wp-link-submit must always be the last focusable element in the dialog.
				// following focusable elements will be skipped on keyboard navigation.
				if ( id === 'wp-link-submit' && ! event.shiftKey ) {
					inputs.close.focus();
					event.preventDefault();
				} else if ( id === 'wp-link-close' && event.shiftKey ) {
					inputs.submit.focus();
					event.preventDefault();
				}
			}

			// Up Arrow and Down Arrow keys.
			if ( 38 !== event.keyCode && 40 !== event.keyCode ) {
				return;
			}

			if ( document.activeElement &&
				( document.activeElement.id === 'link-title-field' || document.activeElement.id === 'url-field' ) ) {
				return;
			}

			// Up Arrow key.
			fn = 38 === event.keyCode ? 'prev' : 'next';
			clearInterval( wpLink.keyInterval );
			wpLink[ fn ]();
			wpLink.keyInterval = setInterval( wpLink[ fn ], wpLink.keySensitivity );
			event.preventDefault();
		},

		keyup: function( event ) {
			// Up Arrow and Down Arrow keys.
			if ( 38 === event.keyCode || 40 === event.keyCode ) {
				clearInterval( wpLink.keyInterval );
				event.preventDefault();
			}
		},

		delayedCallback: function( func, delay ) {
			var timeoutTriggered, funcTriggered, funcArgs, funcContext;

			if ( ! delay )
				return func;

			setTimeout( function() {
				if ( funcTriggered )
					return func.apply( funcContext, funcArgs );
				// Otherwise, wait.
				timeoutTriggered = true;
			}, delay );

			return function() {
				if ( timeoutTriggered )
					return func.apply( this, arguments );
				// Otherwise, wait.
				funcArgs = arguments;
				funcContext = this;
				funcTriggered = true;
			};
		}
	};

	River = function( element, search ) {
		var self = this;
		this.element = element;
		this.ul = element.children( 'ul' );
		this.contentHeight = element.children( '#link-selector-height' );
		this.waiting = element.find('.river-waiting');

		this.change( search );
		this.refresh();

		$( '#wp-link .query-results, #wp-link #link-selector' ).on( 'scroll', function() {
			self.maybeLoad();
		});
		element.on( 'click', 'li', function( event ) {
			self.select( $( this ), event );
		});
	};

	$.extend( River.prototype, {
		refresh: function() {
			this.deselect();
			this.visible = this.element.is( ':visible' );
		},
		show: function() {
			if ( ! this.visible ) {
				this.deselect();
				this.element.show();
				this.visible = true;
			}
		},
		hide: function() {
			this.element.hide();
			this.visible = false;
		},
		// Selects a list item and triggers the river-select event.
		select: function( li, event ) {
			var liHeight, elHeight, liTop, elTop;

			if ( li.hasClass( 'unselectable' ) || li == this.selected )
				return;

			this.deselect();
			this.selected = li.addClass( 'selected' );
			// Make sure the element is visible
			liHeight = li.outerHeight();
			elHeight = this.element.height();
			liTop = li.position().top;
			elTop = this.element.scrollTop();

			if ( liTop < 0 ) // Make first visible element
				this.element.scrollTop( elTop + liTop );
			else if ( liTop + liHeight > elHeight ) // Make last visible element
				this.element.scrollTop( elTop + liTop - elHeight + liHeight );

			// Trigger the river-select event
			this.element.trigger( 'river-select', [ li, event, this ] );
		},
		deselect: function() {
			if ( this.selected )
				this.selected.removeClass( 'selected' );
			this.selected = false;
		},
		prev: function() {
			if ( ! this.visible )
				return;

			var to;
			if ( this.selected ) {
				to = this.selected.prev( 'li' );
				if ( to.length )
					this.select( to );
			}
		},
		next: function() {
			if ( ! this.visible )
				return;

			var to = this.selected ? this.selected.next( 'li' ) : $( 'li:not(.unselectable):first', this.element );
			if ( to.length )
				this.select( to );
		},
		ajax: function( callback ) {
			var self = this,
				delay = this.query.page == 1 ? 0 : wpLink.minRiverAJAXDuration,
				response = wpLink.delayedCallback( function( results, params ) {
					self.process( results, params );
					if ( callback )
						callback( results, params );
				}, delay );

			this.query.ajax( response );
		},
		change: function( search ) {
			if ( this.query && this._search == search )
				return;

			this._search = search;
			this.query = new Query( search );
			this.element.scrollTop( 0 );
		},
		process: function( results, params ) {
			var list = '', alt = true, classes = '',
				firstPage = params.page == 1;

			if ( ! results ) {
				if ( firstPage ) {
					list += '<li class="unselectable no-matches-found"><span class="item-title"><em>' +
						wpLinkL10n.noMatchesFound + '</em></span></li>';
				}
			} else {
				$.each( results, function() {
					classes = alt ? 'alternate' : '';
					classes += this.title ? '' : ' no-title';
					list += classes ? '<li class="' + classes + '">' : '<li>';
					list += '<input type="hidden" class="item-permalink" value="' + this.permalink + '" />';
					list += '<span class="item-title">';
					list += this.title ? this.title : wpLinkL10n.noTitle;
					list += '</span><span class="item-info">' + this.info + '</span></li>';
					alt = ! alt;
				});
			}

			this.ul[ firstPage ? 'html' : 'append' ]( list );
		},
		maybeLoad: function() {
			var self = this,
				el = this.element,
				bottom = el.scrollTop() + el.height();

			if ( ! this.query.ready() || bottom < this.contentHeight.height() - wpLink.riverBottomThreshold )
				return;

			setTimeout(function() {
				var newTop = el.scrollTop(),
					newBottom = newTop + el.height();

				if ( ! self.query.ready() || newBottom < self.contentHeight.height() - wpLink.riverBottomThreshold )
					return;

				self.waiting.addClass( 'is-active' );
				el.scrollTop( newTop + self.waiting.outerHeight() );

				self.ajax( function() {
					self.waiting.removeClass( 'is-active' );
				});
			}, wpLink.timeToTriggerRiver );
		}
	});

	Query = function( search ) {
		this.page = 1;
		this.allLoaded = false;
		this.querying = false;
		this.search = search;
	};

	$.extend( Query.prototype, {
		ready: function() {
			return ! ( this.querying || this.allLoaded );
		},
		ajax: function( callback ) {
			var self = this,
				query = {
					action : 'wp-link-ajax',
					page : this.page,
					'_ajax_linking_nonce' : inputs.nonce.val()
				};

			if ( this.search )
				query.search = this.search;

			this.querying = true;

			$.post( window.ajaxurl, query, function( r ) {
				self.page++;
				self.querying = false;
				self.allLoaded = ! r;
				callback( r, query );
			}, 'json' );
		}
	});

	$( document ).ready( wpLink.init );
})( jQuery, window.wpLinkL10n, window.wp );
