# Contributing to ROAR

Welcome to ROAR! We're excited you're here and want to contribute.

**Imposter's syndrome disclaimer**[^1]: We want your help. No, really.

There may be a little voice inside your head that is telling you that
you're not ready to be a contributor; that your skills
aren't nearly good enough to contribute. What could you possibly offer a
project like this one?

We assure you - the little voice in your head is wrong. If you can
write code at all, you can contribute code to open-source. Contributing
to open-source projects is a fantastic way to advance one's coding
skills. Writing perfect code isn't the measure of a good developer (that
would disqualify all of us!); it's trying to create something, making
mistakes, and learning from those mistakes. That's how we all improve,
and we are happy to help others learn.

Being a ROAR contributor doesn't just mean writing code, either.
You can help out by writing documentation, tests, or even giving
feedback about the project (and yes - that includes giving feedback
about the contribution process). Some of these contributions may be the
most valuable to the project as a whole, because you're coming to the
project with fresh eyes, so you can see the errors and assumptions that
seasoned contributors have glossed over.

## Practical guide to submitting your contribution

These guidelines are designed to make it as easy as possible to get involved.
If you have any questions that aren't discussed below, please let us know by
opening an [issue](#understanding-issues)!

Before you start, you'll need to set up a free [GitHub][link_github] account
and sign in. Here are some [instructions][link_signupinstructions].

Already know what you're looking for in this guide? Jump to the following sections:

- [One ROAR, many repositories](#roar-repositories)
- [Joining the conversation](#joining-the-conversation)
- [Contributing through Github](#contributing-through-github)
- [Understanding issues](#understanding-issues)
- [Making a change](#making-a-change)
- [Structuring contributions](#roar-coding-style)
- [Licensing](#licensing)

## ROAR Repositories

[ROAR][link_roar_website] is a web application with many interacting components:

- a dashboard web app ([repo][link_dashboard_repo],
  [issues][link_dashboard_issues])
- Firebase cloud functions ([repo][link_cloud_functions_repo], [issues][link_cloud_functions_issues])
- standalone web applications for each ROAR assessment. For example,
  - ROAR-SWR ([repo][link_swr_repo], [issues][link_swr_issues])
  - ROAR-SRE ([repo][link_sre_repo], [issues][link_sre_issues])
  - ROAR-PA ([repo][link_pa_repo], [issues][link_pa_issues])
  - and many more
- ROAR-firekit, an external library that allows the dashboard and ROAR apps to
  communicate with our Firestore databases ([repo][link_firekit_repo], [issues][link_firekit_issues])
- ROAR-utils, an external library that contains common utilities used by the
  ROAR assessments ([repo][link_utils_repo], [issues][link_utils_issues])

Each of these components is housed in it's own GitHub repository, some of which
are public and others private. If the links above don't work, it is probably
because the repository is private and you do not have access.

If you are an experienced ROAR developer and know which repository you want to
work with, you can use that repository's issue tracker and pull request system
to contribute your own enhancements or bug fixes. However, when you are first
getting started, it can be difficult to determine which repository houses the
code that you want to work with. To help, we also maintain a
["parent directory" repository][link_roar_parent_repo] that contains
links to each of the ROAR repositories. It also has its own
[issue tracker][link_roar_parent_issues], where you can discuss ROAR without
having to know anything about its repository structure.

## Joining the conversation

[ROAR][link_roar_website] is primarily maintained by a
[collaborative research group][link_bdelab]. But we welcome contributions from
people outside our group and we make sure to give contributors from outside our
group credit in presentations of the work. In other words, we're excited to have
you join! Most of our discussions will take place on open
[issues](#understanding-issues). We actively monitor this space and look forward
to hearing from you!

## Contributing through GitHub

[git][link_git] is a really useful tool for version control.
[GitHub][link_github] sits on top of git and supports collaborative and
distributed working.

If you're not yet familiar with `git`, there are lots of great resources to
help you _git_ started!
Some of our favorites include the [git Handbook][link_handbook] and
the [Software Carpentry introduction to git][link_swc_intro].

On GitHub, You'll use [Markdown][link_markdown] to chat in issues and pull
requests. You can think of Markdown as a few little symbols around your text
that will allow GitHub to render the text with a little bit of formatting.
For example, you could write words as bold (`**bold**`), or in italics
(`*italics*`), or as a [link][link_rick_roll]
(`[link](https://youtu.be/dQw4w9WgXcQ)`) to another webpage.

GitHub has a really helpful page for getting started with
[writing and formatting Markdown on GitHub][link_writing_formatting_github].

## Understanding issues

Every project on GitHub uses issues slightly differently.

The following outlines how the ROAR developers think about these tools.

**Issues** are individual pieces of work that need to be completed to move the
project forward.
A general guideline: if you find yourself tempted to write a great big issue
that is difficult to be described as one unit of work, please consider splitting
it into two or more issues.

### Issue Labels

Issues are assigned [labels](#issue-labels) which explain how they relate to the
overall project's goals and immediate next steps.

The current list of issue labels are [here][link_labels] and include:

- ![Good first issue](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/good%20first%20issue)
  _These issues contain a task that is amenable to new contributors because it
  doesn't entail a steep learning curve._

  If you feel that you can contribute to one of these issues,
  we especially encourage you to do so!

- ![Bug](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/bug)
  _These issues point to problems in the project._

  If you find new a bug, please give as much detail as possible in your issue,
  including steps to recreate the error.
  If you experience the same bug as one already listed,
  please add any additional information that you have as a comment.

- ![Enhancement](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/enhancement)
  _These issues are asking for new features and improvements to be considered by
  the project._

  Please try to make sure that your requested feature is distinct from any others
  that have already been requested or implemented.
  If you find one that's similar but there are subtle differences,
  please reference the other request in your issue.

In order to define priorities and directions in the development roadmap,
we have two sets of special labels:

| Label                                                                                                                                                                                                                                                                                                                                                                                                                           | Description                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/impact%3A%20high) <br> ![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/impact%3A%20medium) <br> ![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/impact%3A%20low)                                                                                                                | Estimation of the downstream impact the proposed feature/bugfix will have.                |
| ![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/effort%3A%20high) <br> ![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/effort%3A%20medium) <br> ![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/effort%3A%20low)                                                                                                                | Estimation of effort required to implement the requested feature or fix the reported bug. |
| ![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/urgency%3A%20critical) <br> ![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/urgency%3A%20high) <br> ![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/urgency%3A%20medium) <br> ![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/urgency%3A%20low) | Estimation of the urgency of the requested feature or bug fix.                            |

These labels help triage and set priorities of the development tasks.
For instance, consider a bug that prevents users from completing assessments,
has been reported to affect most users, and will be an easy fix because it is a
known old problem that came back.
Such an issue will typically be assigned the following labels
![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/bug)
![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/impact%3A%20high)
![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/effort%3A%20low)
![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/urgency%3A%20critical),
and its priority will be maximal since addressing low-effort high-impact issues
delivers the maximum turnout without increasing the churn by much.
Of course, the implementation of long-term goals may include the scheduling of
![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/impact%3A%20medium)
![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/effort%3A%20high).
Finally,
![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/impact%3A%20low)
![GitHub labels](https://img.shields.io/github/labels/yeatmanlab/roar-dashboard/effort%3A%20high)
issues are less likely to be addressed.

## Making a change

We appreciate all contributions to ROAR,
but those accepted fastest will follow a workflow similar to the following:

1. **Comment on an existing issue or open a new issue referencing your
   addition.**<br />
   This allows other members of the ROAR development team to confirm
   that you aren't overlapping with work that's currently underway and that
   everyone is on the same page with the goal of the work you're going to carry
   out.<br /> [This blog][link_pushpullblog] is a nice explanation of why
   putting this work in up front is so useful to everyone involved.

1. **[Fork][link_fork] the repository that you want to edit to your
   profile.**<br />
   This is now your own unique copy of the repository.
   Changes here won't effect anyone else's work, so it's a safe space to
   explore edits to the code!
   On your own fork of the repository, select Settings -> Actions-> "Disable
   Actions for this repository" to avoid flooding your inbox with warnings
   from our continuous integration suite.

1. **[Clone][link_clone] your forked repository to your machine/computer.**<br />
   While you can edit files [directly on github][link_githubedit], sometimes
   the changes you want to make will be complex and you will want to use a
   [text editor][link_texteditor] that you have installed on your local
   machine/computer. (One great text editor is [vscode][link_vscode]).<br />
   In order to work on the code locally, you must clone your forked
   repository.<br />
   To keep up with changes in the repository,
   add the ["upstream" repository as a remote][link_addremote]
   to your locally cloned repository. For example, to add the upstream ROAR
   dashboard repository, type

   ```Shell
   git remote add upstream https://github.com/yeatmanlab/roar-dashboard.git
   ```

   Make sure to [keep your fork up to date][link_updateupstreamwiki] with the
   upstream repository.<br />
   For example, to update your main branch on your local cloned repository:

   ```Shell
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

1. **Install a development version of the software so that your local changes
   are reflected in your local tests**<br />
   In most cases, you can install a development version of by navigating to the
   root of your repository and then typing

   ```Shell
   npm install
   ```

1. **Create a [new branch][link_branches] to develop and maintain the proposed
   code changes.**<br />
   For example:

   ```Shell
   git fetch upstream  # Always start with an updated upstream
   git checkout -b fix/bug-1222 upstream/main
   ```

   Please consider using appropriate branch names as those listed below:

   | Branch name               | Use case                           |
   | ------------------------- | ---------------------------------- |
   | `fix/<some-identifier>`   | for bugfixes                       |
   | `enh/<feature-name>`      | for new features                   |
   | `tst/<feature-name>`      | for new or updated tests           |
   | `doc/<some-identifier>`   | for documentation improvements     |
   | `sty/<some-identifier>`   | for changes to coding style only   |
   | `ref/<some-identifier>`   | for refactoring existing code      |
   | `ci/<some-identifier>`    | for continuous integration changes |
   | `maint/<some-identifier>` | for repository maintenance         |

1. **Make the changes you've discussed, following the [ROAR coding
   style](#roar-coding-style).**<br />
   Try to keep the changes focused: it is generally easy to review changes that
   address one feature or bug at a time.
   In many of our repositories, you can test your changes locally using

   ```Shell
   npm run lint
   npm run test
   ```

   Once you are satisfied with your local changes, [add/commit/push them][link_add_commit_push]
   to the branch on your forked repository.

1. **Submit a [pull request][link_pullrequest].**<br />
   A member of the development team will review your changes to confirm
   that they can be merged into the main code base.<br />
   Pull request titles should begin with a descriptive prefix
   (for example, `ENH: Add adaptive testing`):

   - `FIX`: bug fixes
   - `ENH`: enhancements or new features
   - `TST`: new or updated tests
   - `DOC`: new or updated documentation
   - `STY`: style changes
   - `REF`: refactoring existing code
   - `CI`: updates to continous integration infrastructure
   - `MAINT`: general maintenance
   - For works-in-progress, add the `WIP` prefix in addition to the descriptive prefix.
     Pull-requests tagged with `WIP:` will not be merged until the tag is removed.

1. **Have your PR reviewed by the development team, and update your changes
   accordingly in your branch.**<br />
   The reviewers will take special care in assisting you to address their
   comments, as well as dealing with conflicts and other tricky situations
   that could emerge from distributed development.

## ROAR coding style

Most ROAR repositories use [prettier][link_prettier] and [eslint][link_eslint]
to format code contributions to a common style. Pull requests will
automatically be checked for compliance durint review.

When you run `npm install`, it should initialize initialize
[Husky pre-commit hooks][link_husky] to automatically format your local changes
for style compliance before you commit them. This is the easiest way to ensure
that your much appreciated contribution is not delayed due to formatting or
style compliance. If you know what you're doing and want to explicitly skip
these pre-commit hooks, follow [these directions][link_husky_skip_hooks].

### Documentation

We ask that you document your contributions by following these standards:

1. Document as you code by writing comments in your code to explain "why"
   something is done a certain way, not just "what" the code does. This is
   especially important for complex logic or decisions that might not be
   immediately obvious to someone new to the codebase.

1. Write clear and descriptive commit messages. They are the first line of
   documentation and provide a history of changes and the reasoning behind them.

1. Use [JSDoc comments][link_jsdoc] to document modules, namespaces, functions,
   classes, methods, and interfaces. For all functions, classes, and methods,
   document the parameters, return types, exceptions, and any side effects.

1. Update the ROAR developer documentation if necessary. We maintain
   [centralized ROAR developer documentation][link_roar_developer_documentation] in
   a [separate repository][link_roar_docs_repo]. This allows us not only to
   centralize documentation of each ROAR project, but also to document the
   interactions between different ROAR components. We ask that all code
   contributors update the centralized ROAR developer documentation if necessary.

1. Be direct. Use the active voice and present tense. Avoid jargon,
   colloquialisms, and unnecessarily complex words. The goal is to be understood by
   as wide an audience as possible.

1. Explain technical terms. When you must use technical terms, briefly explain
   them or link to a good external explanation.

1. Keep it short and sweet. More documentation isn't always better. Be concise.
   Aim to provide maximum value with minimum words to respect the reader's time.

## Licensing

Nearly all ROAR repositories are licensed under the
[Stanford Academic Software License for ROAR:tm:][link_license]. By contributing
to ROAR, you acknowledge that any contributions will be licensed under the same
terms as those listed in the repository.

## Notes for core developers and maintainers

### Pull Request Reviews

As a core developer, your insights and feedback are invaluable to maintaining
the high quality and consistency of our project. The review process is not only
about ensuring code quality but also about fostering a collaborative and
welcoming community. Here are some guidelines to help you conduct effective and
constructive pull request (PR) reviews:

1. Timeliness

   - Respond promptly:
     Aim to review PRs within a reasonable timeframe, ideally within 48 hours
     during the workweek. This helps maintain project momentum and keeps
     contributors engaged.

   - Communicate delays:
     If you are unable to review within the expected timeframe, inform the
     contributor, so they know their work hasn't been overlooked.

1. Thoroughness

   - Review completely:
     Ensure you have a clear understanding of the PR's purpose and changes. Review
     all changes thoroughly, not just the parts that might be most relevant to
     your expertise.

   - Test locally:
     When possible, checkout the PR branch and test the changes locally. This can
     help catch issues that are not immediately visible through code review alone.

1. Constructive Feedback

   - Be kind and respectful:
     Remember that behind every contribution is a person who has invested time and
     effort. Approach your review with kindness and respect. Offer constructive
     feedback and avoid harsh criticism.

   - Suggest improvements:
     If you see areas for improvement, provide clear, actionable suggestions.
     Include code snippets, links to documentation, or examples when possible.

1. Clarity and Precision

   - Be specific:
     When requesting changes, be specific about what needs to be addressed and
     why. This helps contributors understand your feedback and how to act on it.

   - Ask questions:
     If something is unclear, ask questions rather than making assumptions. This
     can lead to better understanding and sometimes even simpler solutions.

1. Encouragement and Acknowledgment

   - Praise good work:
     Acknowledge and praise good work. Recognition can be incredibly motivating
     and encourages further contributions.

   - Encourage discussion:
     Encourage contributors to discuss their approach, especially if there are
     multiple ways to solve a problem. Open dialogue can lead to innovative
     solutions and stronger community bonds.

1. Security and Compliance

   - Check for security flaws:
     Always be on the lookout for potential security vulnerabilities in
     contributions. If you suspect a security issue, flag it immediately following
     the project's security protocol.

   - Ensure compliance:
     Verify that contributions comply with the project's licensing and
     contribution guidelines. This includes checking for proper attribution of
     third-party code and ensuring that all dependencies are compatible with the
     project's license.

### Releases

Most ROAR repositories publish three different kinds of releases:

- Development releases are published with temporary unique URLs for each
  submitted pull request (PR).

- Staging releases are published on every commit to the main branch. For
  example, the roar-dashboard repoitory publishes these to roar-staging.web.app.

- Production releases are published on every version tag.

In order to publish a production release, you must run

```Shell
npm version <major|minor|patch>
```

and the npm scripts should take care of the rest. Do this on the main branch
with a clean working directory after all of the changes that you would like to
incorporate have been merged.

So a typical release workflow would be

1. Merge all the PRs with changes you'd like to release into the main branch.

1. Test the consolidated changes on the staging release.

1. Once satisfied, publish the production release on the main branch using `npm
version <major|minor|patch>`.

1. After all of the npm scripts and GitHub actions have completed, there will be
   a new version tag on GitHub. Using the GitHub web console, create a new release
   from that tag, complete with release notes.

[^1]:
    The imposter syndrome disclaimer was originally written by
    [Adrienne Lowe](https://github.com/adriennefriend) for a
    [PyCon talk](https://www.youtube.com/watch?v=6Uj746j9Heo), and was
    adapted based on its use in the README file for the
    [MetPy project](https://github.com/Unidata/MetPy).

[link_add_commit_push]: https://help.github.com/articles/adding-a-file-to-a-repository-using-the-command-line
[link_addremote]: https://help.github.com/articles/configuring-a-remote-for-a-fork
[link_bdelab]: https://edneuro.stanford.edu
[link_branches]: https://help.github.com/articles/creating-and-deleting-branches-within-your-repository/
[link_clone]: https://help.github.com/articles/cloning-a-repository
[link_cloud_functions_issues]: https://github.com/yeatmanlab/roar-firebase-functions/issues
[link_cloud_functions_repo]: https://github.com/yeatmanlab/roar-firebase-functions
[link_dashboard_issues]: https://github.com/yeatmanlab/roar-dashboard/issues
[link_dashboard_repo]: https://github.com/yeatmanlab/roar-dashboard
[link_eslint]: https://eslint.org/
[link_firekit_issues]: https://github.com/yeatmanlab/roar-firekit/issues
[link_firekit_repo]: https://github.com/yeatmanlab/roar-firekit
[link_fork]: https://help.github.com/articles/fork-a-repo/
[link_git]: https://git-scm.com/
[link_github]: https://github.com/
[link_githubedit]: https://help.github.com/articles/editing-files-in-your-repository
[link_handbook]: https://guides.github.com/introduction/git-handbook/
[link_husky_skip_hooks]: https://typicode.github.io/husky/how-to.html#skipping-git-hooks
[link_labels]: https://github.com/yeatmanlab/roar/labels
[link_license]: https://github.com/yeatmanlab/roar-dashboard/blob/main/LICENSE
[link_markdown]: https://daringfireball.net/projects/markdown
[link_pa_issues]: https://github.com/yeatmanlab/roar-pa/issues
[link_pa_repo]: https://github.com/yeatmanlab/roar-pa
[link_prettier]: https://prettier.io/
[link_pullrequest]: https://help.github.com/articles/creating-a-pull-request-from-a-fork
[link_pushpullblog]: https://www.igvita.com/2011/12/19/dont-push-your-pull-requests/
[link_rick_roll]: https://www.youtube.com/watch?v=dQw4w9WgXcQ
[link_roar_parent_issues]: https://github.com/yeatmanlab/roar/issues
[link_roar_parent_repo]: https://github.com/yeatmanlab/roar
[link_roar_website]: https://roar.stanford.edu
[link_signupinstructions]: https://help.github.com/articles/signing-up-for-a-new-github-account
[link_sre_issues]: https://github.com/yeatmanlab/roar-sre/issues
[link_sre_repo]: https://github.com/yeatmanlab/roar-sre
[link_swc_intro]: http://swcarpentry.github.io/git-novice/
[link_swr_issues]: https://github.com/yeatman/roar-swr/issues
[link_swr_repo]: https://github.com/yeatmanlab/roar-swr
[link_texteditor]: https://en.wikipedia.org/wiki/Text_editor
[link_updateupstreamwiki]: https://help.github.com/articles/syncing-a-fork/
[link_utils_issues]: https://github.com/yeatmanlab/roar-utils/issues
[link_utils_repo]: https://github.com/yeatmanlab/roar-utils
[link_vscode]: https://code.visualstudio.com/
[link_writing_formatting_github]: https://help.github.com/articles/getting-started-with-writing-and-formatting-on-github
[link_jsdoc]: https://jsdoc.app/
[link_roar_developer_documentation]: https://yeatmanlab.github.io/roar-docs/
[link_roar_docs_repo]: https://github.com/yeatmanlab/roar-docs
[link_husky]: https://typicode.github.io/husky/
