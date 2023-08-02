"""File handling that works for either a local server or on the web app."""
import os
from shutil import rmtree

try:
    CWD = os.environ["APP_PATH"]
except KeyError:
    CWD = os.getcwd()

DELETE_TIME_MS = 2 * 60 * 60 * 1000


def _check_data_folder(folder_name: str) -> str:
    """Check if folder is a user data folder.

    :param folder_name: folder file name
    :type folder_name: str
    :return: UID of user of folder or "" if not valid
    :rtype: str
    """
    UID = folder_name.split("/")[-1]
    right_length = len(UID) >= 17
    if right_length and UID.isnumeric():
        return UID[:-5]
    else:
        return ""


def _check_to_delete(old_timestamp_str: str, new_timestamp_str: str) -> bool:
    """Check if user data folder is more than 2 hours old.

    :param old_timestamp_str: timestamp from the user data folder
    :type old_timestamp_str: str
    :param new_timestamp_str: current timestamp
    :type new_timestamp_str: str
    :return: true if folder older than $DELETE_TIME_MS (2 hours)
    :rtype: bool
    """
    old: int = int(old_timestamp_str)
    new: int = int(new_timestamp_str)
    if new - old > DELETE_TIME_MS:
        return True
    else:
        return False


def delete_old_folders(UID: str) -> None:
    """Call when new user connects: checks name of each folder (a timestamp + random UID) and if more han 2 hours old, delete.

    :param UID: user ID of new connection, which is taken as the current timestamp old folders are compared to.
    :type UID: str
    """
    current_timestamp = UID[:-5]
    subfolders = [f.path for f in os.scandir(CWD) if f.is_dir()]
    n_delete = 0
    for folder in subfolders:
        old_timestamp = _check_data_folder(folder)
        if old_timestamp != "":
            delete = _check_to_delete(old_timestamp, current_timestamp)
            if delete:
                rmtree(folder)  # rmtree needed for proper delete
                n_delete += 1
        else:
            pass
    print(f"Deleted {n_delete} old folders that were more than {DELETE_TIME_MS}ms old.")


def delete_feature_file(folder_name: str, delete_idx: int) -> int:
    """Delete a given user file(s) then rename all subsequent files to account for this. This involves renaming twice to avoid a confilct.

    :param folder_name: user data folder name
    :type folder_name: str
    :param delete_idx: id of user feature file to delete
    :type delete_idx: int
    :return: 0 if successful
    :rtype: int
    """
    feature_file_paths = []
    for fp in os.listdir(folder_name):
        if "features" in fp:
            feature_file_paths.append(fp)

    tmp_fps = []
    for i, feature_fp in enumerate(feature_file_paths):
        file_idx = int(feature_fp.split("_")[-1][:-4])
        print(feature_fp, file_idx, delete_idx)
        if file_idx == delete_idx:
            print("deleting")
            os.remove(f"{folder_name}/{feature_fp}")
        elif file_idx > delete_idx:
            # need to do it this way to avoid writing to file that already exists (file paths not ordered by index!)
            new_fp = feature_fp[:-5] + f"{file_idx - 1}.npz_{i % 10}"
            os.rename(f"{folder_name}/{feature_fp}", f"{folder_name}/{new_fp}")
            tmp_fps.append(f"{folder_name}/{new_fp}")
    print(tmp_fps, os.listdir(folder_name))
    for fp in tmp_fps:
        os.rename(fp, fp[:-2])
    return 0


def delete_all_features(folder_name: str) -> int:
    """Delete all features files in a folder.

    :param folder_name: user data folder name
    :type folder_name: str
    :return: 0 if successful
    :rtype: int
    """
    for fp in os.listdir(folder_name):
        if "features" in fp:
            os.remove(f"{folder_name}/{fp}")
    return 0
