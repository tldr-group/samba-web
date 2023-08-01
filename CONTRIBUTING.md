## Contributing
Contributions are welcome and appreciated. There are a few ways to contribute:

### 1. Reporting Bugs
Please report bugs at the repo's [issue tracker](https://github.com/tldr-group/samba-web/issues). When reporting, please include a detailed description of how to reproduce the bug, what OS/enivronment you're on and tag the issue with the 'bug' label.
### 2. Fixing Bugs
Issues tagged with 'bug' and 'help wanted' are open to all. If it's not tagged with 'help wanted' and you have a fix, submit a pull request (but no guarantees of a merge).
### 3. Documentation
If you think some of the docs aren't clear, raise an issue. If possible, try adding more documentation to bits you understand and feel are lacking.
### 4. Submit Feedback
This can be in the form of issues requesting a feature, or describing a general problem you'd like fixed that's not a bug.
### 5. Implementing Features
The most difficult! There are a few features that would be nice to have implemented - check out the issues tracker for issues tagged 'enhancements' and 'help wanted'. Here's a list of the big ones:
- **GPU featurisation using** [pyClesperanto](https://github.com/clEsperanto/pyclesperanto_prototype/): should be mostly a drag n drop replacement of multiscale_features so long as it returns an np array
- **3D featurisation**: currently featurisation is 2D only
- **A native app/GUI**: originally this project was a Python + Tkinter project, but that has largely fallen by the wayside. An updated Python version would be able to leverage all the GPU accelerations and ideally have a nice user interface without needing to install node/npm/yarn. It should be relatively easy to detach all the core logic from the server logic and wrap into a GUI.

## Instructions
1. Fork the `SAMBA` repo on GitHub.
2. Clone your fork locally:

```
git clone git@github.com:your_name_here/SAMBA.git
```
3. Follow all the installation instructions on [`README.md`](README.md), including creating a virtual environment *etc.*
4. Create a branch for local development:

```
git checkout -b name-of-your-bugfix-or-feature
```
5. If making changes to the backend, check the tests pass:
```
python backend/tests.py $FIJI_PATH
```
6. Commit your changes and push your branch to GitHub:

```
git add .
git commit -m "Your detailed description of your changes."
git push origin name-of-your-bugfix-or-feature
```
7. Submit a pull request through the GitHub website. Ensure new backend features have associated tests and any new code has docstrings and comments.


This document was adapted from https://github.com/tldr-group/taufactor/blob/main/CONTRIBUTING.md