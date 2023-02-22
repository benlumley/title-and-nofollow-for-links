=== Title and Nofollow For Links (Classic Editor) ===
Contributors: WPKube
Tags: checkbox, insert, link, links, meta, nofollow, popup, rel nofollow, seo, editor, link, TinyMCE, title
Requires at least: 4.2
Tested up to: 6.1
Stable tag: trunk 

The plugin adds a title and a rel="nofollow" checkbox to the insert link popup box. Only for Classic Editor, NOT Block Editor.

== Description ==

The plugin restores the `Title` field (that was removed from WordPress 4.2) in the insert link popup box and adds a new `Add rel="nofollow" to link` checkbox to it. 

**Gutengerg (Block Editor) Note**: At the moment it's not possible to add the functionality to Gutenberg, it's a different system from the classic editor and it does not have a hook/filter which allows adding custom settings. As soon as it becomes possible to add the functionality to Gutenberg we will update the plugin.

This plugin has been adopted and maintained by [WPKube](https://www.wpkube.com/), a popular WordPress resource site, where you can find guides on [WordPress plugins](https://www.wpkube.com/category/wordpress-plugins/), [WordPress Hosting](https://www.wpkube.com/best-wordpress-hosting/), and more.

== Installation ==

1. Upload `title-and-nofollow-for-links` folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the `Plugins` menu in WordPress.
3. That's all.


== Frequently Asked Questions ==

= Does the plugin support localization? =

Yes, please use [translate.wordpress.org](https://translate.wordpress.org/projects/wp-plugins/title-and-nofollow-for-links).


== Screenshots ==

1. The insert link popup box when the plugin is activated.
2. The source code of the added link.

== Changelog ==
= 1.12 (February 3rd, 2022 ) =
* Bumped up the tested up to 6.1
* Changed name and description to specify it's only for Classic Editor

= 1.11 (December 27th, 2020 ) =
* Fix for deprecated jQuery functions

= 1.10 (June 1st, 2020) =
* Remove unnecessary blank space when generating the rel value

= 1.09 (February 6, 2020 ) =
* fixes issue with spacing

= 1.08 (January 14, 2020) =
* adds option for "sponsored" rel

= 1.07 =
* fixes another conflict with [Toolset Types plugin](https://wordpress.org/plugins/types/)

= 1.06 =
* fixes conflict with [Toolset Types plugin](https://wordpress.org/plugins/types/)

= 1.05 =
* minor tweaks

= 1.04 =
* update wplink.js to last version. 

= 1.03 =
* fixed js-bug (thanks to @themagnifico). 

= 1.01 =
* fixed js-bug in Text editor.

= 1.00 =
* first version
