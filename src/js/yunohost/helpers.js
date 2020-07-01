(function() {
    // Get application context
    var app = Sammy.apps['#main'];
    var store = app.store;

    // The logic used to temporily disable transition is from
    // https://stackoverflow.com/a/16575811
    function whichTransitionEvent(){
        var t;
        var el = document.createElement('fakeelement');
        var transitions = {
          'transition':'transitionend',
          'OTransition':'oTransitionEnd',
          'MozTransition':'transitionend',
          'WebkitTransition':'webkitTransitionEnd'
        }

        for(t in transitions){
            if( el.style[t] !== undefined ){
                return transitions[t];
            }
        }
    };
    var transitionEvent = whichTransitionEvent();

    function resetSliders()
    {
        // Disable transition effects
        $('#slider-container').addClass('notransition');
        // Delete the left/right temporary stuff only used during animation
        $('#slideTo').css('display', 'none');
        $('#slideTo').html("");
        $('#slideBack').css('display', 'none');
        $('#slideBack').html("");
        // Set the margin-left back to 0
        $('#slider-container').css('margin-left', '0');
        // c.f. the stackoverflow thread
        $('#slider-container')[0].offsetHeight;
        // Remove the binding to this event handler for next times
        // Re-enable transition effects
        $('#slider-container').removeClass('notransition');
    }

    /**
     * Helpers
     *
     */
    app.helpers({

        //
        // Pacman loader management
        //

        showLoader: function() {
            app.loaded = false; // Not sure if that's really useful ... this is from old code with no explanation what it really does ...
            if ($('div.loader').length === 0) {
                $('#main').append('<div class="loader loader-content"></div>');
            }
        },

        hideLoader: function() {
            app.loaded = true; // Not sure if that's really useful ... this is from old code with no explanation what it really does ...
            $('div.loader').remove();
        },

        // Flash helper to diplay instant notifications
        flash: function (level, message) {
            if (!store.get('flash')) {
                store.set('flash', true);
            }

            // Helper CSS class on main wrapper
            $('#slider').addClass('with-flashMessage');

            // If the line is a bash command
            if (level === 'info' && message.charAt(0) === '+') {
                level = 'log';
            }

            message = message.split("\n").join("<br />");

            // If the message starts with a progress bar
            progressbar = message.match(/^\[#*\+*\.*\] > /);
            if (progressbar)
            {
                progressbar = progressbar[0];
                // Remove the progress bar from the mesage
                message = message.replace(progressbar,"");
                // Compute percent
                done = (progressbar.match(/#/g)||[]).length;
                ongoing = (progressbar.match(/\+/g)||[]).length;
                remaining = (progressbar.match(/\./g)||[]).length;
                total = done + ongoing + remaining;
                done = done * 100 / total;
                ongoing = ongoing * 100 / total;
                // Actually build the message with the progress bar
                message = '<div class="progress"><div class="progress-bar progress-bar-success" role="progressbar" style="width:'+done+'%"></div><div class="progress-bar progress-bar-striped active" role="progressbar" style="width:'+ongoing+'%;"></div></div><p style="display: inline-block;">' + message + '</p>';
            }
            else
            {
                message = '<p>'+message+'</p>';
            }

            // Add message
            $('#flashMessage .messages')
                .prepend('<div class="alert alert-'+ level +'">'+message+'</div>');

            // Scroll to top to view new messages
            $('#flashMessage').scrollTop(0);
        },

        checkInstall: function(callback) {
            // Get base url from store or guess from current url
            var baseUrl = (store.get('url') !== null) ? store.get('url')
                            : window.location.hostname + '/yunohost/api';

            // Call API endpoint
            $.ajax({
                dataType: "json",
                url: 'https://'+ baseUrl +'/installed',
                timeout: 3000,
                success: function(data) {
                    callback(data.installed);
                },
                fail: function() {
                    callback(undefined);
                }
            });
        },

        // API call
        api: function(method, uri, data, callback, callbackOnFailure, websocket) {
            c = this;

            method = typeof method !== 'undefined' ? method : 'GET';
            data   = typeof data   !== 'undefined' ? data   : {};
            if (window.navigator && window.navigator.language && (typeof data.locale === 'undefined')) {
                data.locale = y18n.locale || window.navigator.language.substr(0, 2);
            }

            c.showLoader();

            call = function(uri, callback, method, data, callbackOnFailure) {

                // Define default callback for failures
                if (typeof callbackOnFailure !== 'function') {
                    callbackOnFailure = function(xhr) {
                        if (xhr.status == 200) {
                            // Fail with 200, WTF
                            callback({});
                        }
                        // Unauthorized or wrong password
                        else if (xhr.status == 401) {
                            if (uri === '/login') {
                                c.flash('fail', y18n.t('wrong_password'));
                            } else {
                                c.flash('fail', y18n.t('unauthorized'));
                                c.redirect('#/login');
                            }
                        }
                        // 500
                        else if (xhr.status == 500) {
                            try {
                                error_log = JSON.parse(xhr.responseText);
                                error_log.route = error_log.route.join(' ') + '\n';
                                error_log.arguments = JSON.stringify(error_log.arguments);
                            }
                            catch (e)
                            {
                                error_log = {};
                                error_log.route = "Failed to parse route";
                                error_log.arguments = "Failed to parse arguments";
                                error_log.traceback = xhr.responseText;
                            }
                            c.flash('fail', y18n.t('internal_exception', [error_log.route, error_log.arguments, error_log.traceback]));
                        }
                        // 502 Bad gateway means API is down
                        else if (xhr.status == 502) {
                            c.flash('fail', y18n.t('api_not_responding'));
                        }
                        // More verbose error messages first
                        else if (typeof xhr.responseText !== 'undefined') {
                            c.flash('fail', xhr.responseText);
                        }
                        // 0 mean "the connexion has been closed" apparently
                        else if (xhr.status == 0) {
                            var errorMessage = xhr.status+' '+xhr.statusText;
                            c.flash('fail', y18n.t('error_connection_interrupted', [errorMessage]));
                            console.log(xhr);
                        }
                        // Return HTTP error code at least
                        else {
                            var errorMessage = xhr.status+' '+xhr.statusText;
                            c.flash('fail', y18n.t('error_server_unexpected', [errorMessage]));
                            console.log(xhr);
                        }

                        c.hideLoader();

                        // Force scrollTop on page load
                        $('html, body').scrollTop(0);
                        store.clear('slide');
                    };
                }

                jQuery.ajax({
                    url: 'https://' + store.get('url') + uri,
                    type: method,
                    crossdomain: true,
                    data: data,
                    traditional: true,
                    dataType: 'json'
                })
                .always(function(xhr, ts, error) {
                })
                .done(function(data) {
                    data = data || {};
                    callback(data);
                })
                .fail(callbackOnFailure);
            };

            websocket = typeof websocket !== 'undefined' ? websocket : true;
            if (websocket) {
                // Open a WebSocket connection to retrieve live messages from the moulinette
                var ws = new WebSocket('wss://'+ store.get('url') +'/messages');
                // Flag to avoid to call twice the API
                // We need to set that in ws object as we need to use it in ws.onopen
                // and several ws object could be running at the same time...
                ws.api_called = false;
                ws.onmessage = function(evt) {
                    // console.log(evt.data);
                    $.each($.parseJSON(evt.data), function(k, v) {
                        c.flash(k, v);
                    });
                };

                // If not connected, WebSocket connection will raise an error, but we do not want to interrupt API request
                ws.onerror = function () {
                    ws.onopen();
                };

                ws.onclose = function() { };

                ws.onopen = function () {
                    if (!ws.api_called) {
                        ws.api_called = true;
                        call(uri, callback, method, data, callbackOnFailure);
                    }
                };
            } else {
                call(uri, callback, method, data, callbackOnFailure);
            }

        },

        /**
         * Generic fetch to query the yunohost API.

         * @arg {string} uri
         * @arg {Object} [options] - fetch options.
         * @arg {string} [options.method='GET'] - fetch method.
         * @arg {string} [options.type='json'] - fetch response type method name.
         * @arg {Object} [options.params={}] - an object literal that will be converted to URLSearchParams and sent as the body for a post request.
         * @arg {Object} [options.websocket=true] - opens a websocket connection before resolving.
         * @return {Promise} Promise that resolve an array `[err=true|false, result1|undefined, ...]`
         */
        apiNew: function(uri, {method = 'GET', type = 'json', params = {}, websocket = true} = {}) {
            // Had to use a promise here since the fetch can't be returned from the `ws.onopen` callback
            return new Promise(resolve => {
                if (window.navigator && window.navigator.language && (typeof params.locale === 'undefined')) {
                    params.locale = y18n.locale || window.navigator.language.substr(0, 2);
                }

                this.showLoader();

                fetch_options = {
                        method,
                        credentials: 'include',
                        mode: 'cors',
                        headers: {
                            // FIXME is it important to keep this previous `Accept` header ?
                            // 'Accept': 'application/json, text/javascript, */*; q=0.01',
                            // Auto header is :
                            // "Accept": "*/*",

                            // Also is this still important ? (needed by back-end)
                            'X-Requested-With': 'XMLHttpRequest',
                        }
                };

                if (method == 'POST') {
                    const urlParams = new URLSearchParams();
                    for (const [key, value] of Object.entries(params)) {
                        urlParams.append(key, value);
                    }
                    fetch_options.body = urlParams;
                }

                const call = () => {
                    return fetch('https://' + store.get('url') + uri, fetch_options)
                    .then(async response => {
                        // FIXME Is this needed or jquery specific weird behavior ?
                        // if (response.status == 200) {
                        //     // Fail with 200, WTF
                        //     return {};
                        // }

                        // Unauthorized or wrong password
                        if (response.status == 401) {
                            if (uri === '/login') {
                                throw new Error(y18n.t('wrong_password'));
                            } else {
                                this.redirect('#/login');
                                throw new Error(y18n.t('unauthorized'));
                            }
                        }
                        // 500
                        else if (response.status == 500) {
                            // FIXME, responseText not part of fetch, can get it with
                            // `response.text()` but it consumes the request.
                            // We can `await response.text()` and parse it as JSON if
                            // needed later
                            try {
                                error_log = JSON.parse(response.responseText);
                                error_log.route = error_log.route.join(' ') + '\n';
                                error_log.arguments = JSON.stringify(error_log.arguments);
                            }
                            catch (e) {
                                error_log = {};
                                error_log.route = "Failed to parse route";
                                error_log.arguments = "Failed to parse arguments";
                                error_log.traceback = response.responseText;
                            }
                            throw new Error(y18n.t('internal_exception', [error_log.route, error_log.arguments, error_log.traceback]));
                        }
                        // 502 Bad gateway means API is down
                        else if (response.status == 502) {
                            throw new Error(y18n.t('api_not_responding'));
                        }
                        // FIXME, responseText not part of fetch, see above (err 500)
                        // More verbose error messages first
                        else if (typeof response.responseText !== 'undefined') {
                            throw new Error(response.responseText);
                        }
                        // 0 mean "the connexion has been closed" apparently
                        else if (response.status == 0) {
                            const errorMessage = response.status + ' ' + response.statusText;
                            console.log(response);
                            throw new Error(y18n.t('error_connection_interrupted', [errorMessage]));
                        }
                        // Return HTTP error code at least
                        else if (!response.ok) {
                            const errorMessage = response.status + ' ' + response.statusText;
                            console.log(response);
                            throw new Error(y18n.t('error_server_unexpected', [errorMessage]));
                        }

                        if (type == 'none') return;
                        return response[type]();
                    })
                    .then(data => {
                        return [false, data]
                    })
                    .catch(error => {
                        this.flash('fail', error.message)

                        this.hideLoader();
                        // Force scrollTop on page load
                        $('html, body').scrollTop(0);
                        store.clear('slide');

                        return [true];
                    })
                }

                // QUESTION: Why do we try to establish a socket connection at every request ?
                // Can't we just open it at page load ?
                // Is it a way to get socket's messages flashed before the actual request result ?
                if (websocket) {
                    // Open a WebSocket connection to retrieve live messages from the moulinette
                    var ws = new WebSocket('wss://'+ store.get('url') +'/messages');
                    // Flag to avoid to call twice the API
                    // We need to set that in ws object as we need to use it in ws.onopen
                    // and several ws object could be running at the same time...
                    ws.api_called = false;
                    ws.onmessage = function(evt) {
                        // console.log(evt.data);
                        $.each($.parseJSON(evt.data), function(k, v) {
                            c.flash(k, v);
                        });
                    };

                    // If not connected, WebSocket connection will raise an error, but we do not want to interrupt API request
                    ws.onerror = function () {
                        ws.onopen();
                    };

                    ws.onclose = function() { };

                    ws.onopen = function () {
                        if (!ws.api_called) {
                            ws.api_called = true;
                            resolve(call());
                        }
                    };
                }
                else {
                    resolve(call())
                }
            });
        },


        // Ask confirmation to the user through the modal window
        confirm: function(title, content, confirmCallback, cancelCallback) {
            c = this;

            // Default callbacks
            confirmCallback = typeof confirmCallback !== 'undefined' ? confirmCallback : function() {};
            cancelCallback = typeof cancelCallback !== 'undefined' ? cancelCallback : function() {};

            c.hideLoader();

            // Get modal element
            var box = $('#modal');

            // Modal title
            if (typeof title === 'string' && title.length) {
                $('.title', box).html(title);
            }
            else {
                box.addClass('no-title');
            }

            // Modal content
            $('.content', box).html(content);

            // Clear any remaining click event that could still be there (e.g.
            // clicking outside the modal window doesn't equal to clicking
            // cancel...
            $('footer button', box).unbind( "click" );

            // Handle buttons
            $('footer button', box)
                .click(function(e){
                    e.preventDefault();

                    $('#modal footer button').unbind( "click" );
                    // Reset & Hide modal
                    box.removeClass('no-title').modal('hide');

                    // Do corresponding callback
                    if ($(this).data('modal-action') == 'confirm') {
                        confirmCallback();
                    }
                    else {
                        cancelCallback();
                    }
                });

            // Show modal
            return box.modal('show');
        },


        // Render view (cross-browser)
        view: function (view, data, callback) {
            c = this;

            // Default
            callback = typeof callback !== 'undefined' ? callback : function() {};

            // Hide loader and modal
            c.hideLoader();
            $('#modal').modal('hide');

            // Render content
            var rendered = this.render('dist/views/'+ view +'.ms', data);

            // Update content helper
            var leSwap = function() {
                rendered.swap(function() {
                    // Clicking on those kind of CSS elements will trigger a
                    // slide effect i.e. the next view rendering will have
                    // store.get('slide') set to 'back' or 'to'
                    $('.slide, .btn-breadcrumb a:not(:last-child)').on('click', function() {
                        $(this).addClass('active');
                        if ($(this).hasClass('back') || $(this).parent('.btn-breadcrumb').length) {
                            store.set('slide', 'back');
                        } else {
                            store.set('slide', 'to');
                        }
                    });

                    // Force scrollTop on page load
                    $('html, body').scrollTop(0);

                    // Run callback
                    callback();
                });
            };

            // Slide back effect
            if (store.get('slide') == 'back') {

                store.clear('slide');
                // Disable transition while we tweak CSS
                $('#slider-container').addClass('notransition');
                // "Delete" the left part of the slider
                $('#slideBack').css('display', 'none');

                // Push the slider to the left
                $('#slider-container').css('margin-left', '-100%');
                // slideTo is the right part, and should contain the old view,
                // so we copypasta what's in the "center" slider (#main)
                $('#slideTo').show().html($('#main').html());
                // leSwap will put the new view in the "center" slider (#main)
                leSwap();

                // So now things look like:
                //                          |                 |
                //                          |   the screen    |
                //                          |                 |
                //
                //       .     #main        .    #slideTo     .
                //       .  the new view    .  the old view   .
                //       ^                          ^
                //  margin-left: -100%             currently shown
                //
                //            =====>>>  sliiiiide  =====>>>

                // Re-add transition effect
                $('#slider-container').removeClass('notransition');

                // add the transition event to detect the end of the transition effect
                transitionEvent
                    && $("#slider-container").off(transitionEvent)
                    && $("#slider-container").on(transitionEvent, resetSliders);

                // And actually play the transition effect that will move the container from left to right
                $('#slider-container').css('margin-left', '0px');
            }
            // Slide to effect
            else if (store.get('slide') == 'to') {

                // Disable transition while we tweak CSS
                $('#slider-container').addClass('notransition');
                // "Delete" the right part of the slider
                $('#slideTo').css('display', 'none');
                // Push the slider to the right
                $('#slider-container').css('margin-left', '0px');
                // slideBack should contain the old view,
                // so we copypasta what's in the "center" slider (#main)
                $('#slideBack').show().html($('#main').html());
                leSwap();

                // So now things look like:
                //
                //                    |                 |
                //                    |   the screen    |
                //                    |                 |
                //
                //      .             .   #slideBack    .     #main      .
                //      .             .  the old view   .  the new view  .
                //      ^             ^        ^
                //   margin-left: -100%      currently shown
                //
                //               <<<===== sliiiiide <<<=======


                // Re-add transition effect
                $('#slider-container').removeClass('notransition');

                // add the transition event to detect the end of the transition effect
                var transitionEvent = whichTransitionEvent();
                transitionEvent
                    && $("#slider-container").off(transitionEvent)
                    && $("#slider-container").on(transitionEvent, resetSliders);

                // And actually play the transition effect that will move the container from right to left
                $('#slider-container').css('margin-left', '-100%');
            }
            // No slideing effect
            else {
                leSwap();
            }
        },

        redirect_to: function(destination, options) {
            c = this;

            options = options !== undefined ? options : {};

            // If destination if the same as current url,
            // we don't want to display the slide animation
            // (or if the code explicitly state to disable slide animation)
            if ((c.path.split("#")[1] == destination.split("#")[1]) || (options.slide == false))
            {
                store.clear('slide');
            }

            // This is a copy-pasta of some of the redirect/refresh code of
            // sammy.js because for some reason calling the original
            // redirect/refresh function in some context does not work >.>
            // (e.g. if you're already on the page)
            c.trigger('redirect', {to: destination});
            c.app.last_location = c.path;
            c.app.setLocation(destination);
            c.app.trigger('location-changed');
        },

        refresh: function() {
            c = this;
            c.redirect_to(c.path, {slide: false});
        },

        //
        // Array / object helpers
        //

        arraySortById: function(arr) {
            arr.sort(function(a, b){
                if (a.id > b.id) {
                    return 1;
                }
                else if (a.id < b.id) {
                    return -1;
                }
                return 0;
            });
        },

        arrayDiff: function(arr1, arr2) {
            arr1 = arr1 || [];
            arr2 = arr2 || [];
            return arr1.filter(function (a) {
                return ((arr2.indexOf(a) == -1) && (a !== ""));
            });
        },

        // Serialize an object
        serialize : function(obj) {
          var str = [];
          for(var p in obj)
            if (obj.hasOwnProperty(p)) {
              str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
            }
          return str.join("&");
        }

    });
})();
