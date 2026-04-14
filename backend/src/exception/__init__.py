import sys
import logging


def error_message_detail(error: Exception, error_detail: sys) -> str:
    """
    Extract detailed error info (file, line, message)
    """

    _, _, exc_tb = error_detail.exc_info()

    if exc_tb is None:
        return f"Error: {str(error)}"

    file_name = exc_tb.tb_frame.f_code.co_filename
    line_number = exc_tb.tb_lineno

    error_message = (
        f"Error in [{file_name}] at line [{line_number}] → {str(error)}"
    )

    logging.error(error_message)

    return error_message


class MyException(Exception):
    def __init__(self, error: Exception, error_detail: sys):
        """
        Accept actual exception, NOT string
        """
        super().__init__(str(error))
        self.error_message = error_message_detail(error, error_detail)

    def __str__(self) -> str:
        return self.error_message