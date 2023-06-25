import os
from shutil import rmtree

try:
    CWD = os.environ["APP_PATH"]
except KeyError:
    CWD = os.getcwd()

DELETE_TIME_SECONDS = 2 * 60 * 60


def _check_data_folder(folder_name: str) -> str:
    UID = folder_name.split("/")[-1]
    right_length = len(UID) >= 17
    if right_length and UID.isnumeric():
        return UID[:-5]
    else:
        return ""


def _check_to_delete(old_timestamp_str: str, new_timestamp_str: str) -> bool:
    old: int = int(old_timestamp_str)
    new: int = int(new_timestamp_str)
    print(new - old)
    if new - old > DELETE_TIME_SECONDS:
        return True
    else:
        return False


def delete_old_folders(UID: str) -> None:
    current_timestamp = UID[:-5]
    subfolders = [f.path for f in os.scandir(CWD) if f.is_dir()]
    n_delete = 0
    for folder in subfolders:
        old_timestamp = _check_data_folder(folder)
        if old_timestamp != "":
            delete = _check_to_delete(old_timestamp, current_timestamp)
            if delete:
                rmtree(folder)
                n_delete += 1
        else:
            pass
    print(
        f"Deleted {n_delete} old folders that were more than {DELETE_TIME_SECONDS}s old."
    )
